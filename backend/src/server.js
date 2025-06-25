const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { exec } = require("child_process");
const app = express();

app.use(
  cors({
    origin: "http://localhost:8080",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

const PORT = 3000;

// Configurações
const videosDir = "./public/videos";
const thumbnailsDir = "./public/thumbnails";
const outputBaseDir = "./temp";

// Cria as pastas necessárias se não existirem
[videosDir, thumbnailsDir, outputBaseDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware para arquivos estáticos
app.use("/public", express.static("public"));
app.use("/streams", express.static("temp"));

// Função para gerar miniatura (retorna Promise)
function generateThumbnail(videoFile) {
  return new Promise((resolve, reject) => {
    const videoName = path.parse(videoFile).name;
    const inputVideo = path.join(videosDir, videoFile);
    const outputThumbnail = path.join(thumbnailsDir, `${videoName}.jpg`);

    exec(
      `ffmpeg -i ${inputVideo} -ss 00:00:01 -vframes 1 -q:v 2 ${outputThumbnail}`,
      (err) => {
        if (err) {
          console.error(`Erro ao gerar miniatura para ${videoFile}:`, err);
          reject(err);
        } else {
          console.log(`Miniatura gerada para ${videoFile}`);
          resolve();
        }
      }
    );
  });
}

function ensureHLSFilesExist(videoName) {
  return new Promise((resolve, reject) => {
    const inputVideo = path.join(videosDir, videoName);
    const videoBaseName = path.parse(videoName).name;
    const outputDir = path.join(outputBaseDir, videoBaseName);
    const outputHLS = path.join(outputDir, "stream.m3u8");

    if (!fs.existsSync(inputVideo)) {
      return reject(new Error(`Vídeo original não encontrado: ${inputVideo}`));
    }

    if (fs.existsSync(outputHLS)) {
      return resolve();
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    exec(
      `ffmpeg -i "${inputVideo}" \
              -profile:v baseline -level 3.0 \
              -s 640x360 -start_number 0 \
              -hls_time 10 -hls_list_size 0 \
              -f hls "${outputHLS}"`,
      (err) => {
        if (err) {
          console.error("Erro ao converter vídeo:", err);
          reject(err);
        } else {
          console.log(`Arquivos HLS gerados para ${videoName}`);
          resolve();
        }
      }
    );
  });
}

// Rota para listar vídeos disponíveis com miniaturas em Base64
app.get("/api/videos", async (req, res) => {
  try {
    const files = await fs.promises.readdir(videosDir);

    const videoFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".mp4", ".mkv", ".mov", ".avi"].includes(ext);
    });

    // Processa cada vídeo para obter nome, URL e miniatura
    const videos = await Promise.all(
      videoFiles.map(async (video) => {
        const videoName = path.parse(video).name;
        const thumbnailPath = path.join(thumbnailsDir, `${videoName}.jpg`);

        // Se a miniatura não existir, cria uma
        if (!fs.existsSync(thumbnailPath)) {
          await generateThumbnail(video);
        }

        // Lê a miniatura como Base64
        const thumbnailBase64 = await fs.promises.readFile(thumbnailPath, {
          encoding: "base64",
        });
        const thumbnailDataUrl = `data:image/jpeg;base64,${thumbnailBase64}`;

        return {
          name: video,
          thumbnail: thumbnailDataUrl,
          thumbnailUrl: `/public/thumbnails/${videoName}.jpg`,
          watchUrl: `/watch/${video}`,
        };
      })
    );

    res.json(videos);
  } catch (err) {
    console.error("Erro ao listar vídeos:", err);
    res.status(500).json({ error: "Erro ao carregar lista de vídeos" });
  }
});

// Rota para servir os arquivos HLS (verifica e gera se necessário)
app.get("/streams/:videoName/:file", async (req, res) => {
  try {
    const videoName = req.params.videoName;
    const filePath = path.join(
      outputBaseDir,
      req.params.videoName,
      req.params.file
    );

    // Primeiro verifica se o arquivo HLS já existe
    if (!fs.existsSync(filePath)) {
      // Se não existe, precisamos encontrar o vídeo original correspondente
      const videoFiles = await fs.promises.readdir(videosDir);
      const originalVideo = videoFiles.find((file) => {
        const nameWithoutExt = path.parse(file).name;
        return nameWithoutExt === videoName;
      });

      if (!originalVideo) {
        throw new Error("Vídeo original não encontrado");
      }

      // Gera os arquivos HLS
      await ensureHLSFilesExist(originalVideo);
    }

    // Serve o arquivo
    res.sendFile(filePath, { root: __dirname });
  } catch (err) {
    console.error("Erro ao servir arquivo HLS:", err);
    res.status(404).send("Arquivo não encontrado");
  }
});

// Rota para assistir um vídeo específico
app.get("/watch/:videoName", async (req, res) => {
  try {
    const videoName = req.params.videoName;
    await ensureHLSFilesExist(videoName);
    servePlayer(res, videoName);
  } catch (err) {
    console.error("Erro ao preparar vídeo:", err);
    res.status(500).send("Erro ao processar vídeo");
  }
});

function servePlayer(res, videoName) {
  const videoBaseName = path.parse(videoName).name;
  const hlsPath = `/streams/${videoBaseName}/stream.m3u8`;

  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Player HLS: ${videoName}</title>
            <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
        </head>
        <body>
            <video id="video" width="640" controls></video>
            <script>
                const video = document.getElementById('video');
                if (Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource('${hlsPath}');
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = '${hlsPath}';
                    video.addEventListener('loadedmetadata', () => video.play());
                }
            </script>
        </body>
        </html>
    `);
}

// Rota principal que mostra a lista de vídeos com miniaturas
app.get("/", (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Lista de Vídeos</title>
            <style>
                .video-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 20px;
                    padding: 20px;
                }
                .video-item {
                    cursor: pointer;
                    text-align: center;
                }
                .video-thumbnail {
                    width: 100%;
                    height: 120px;
                    object-fit: cover;
                    border-radius: 5px;
                }
                .video-title {
                    margin-top: 8px;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <h1>Vídeos Disponíveis</h1>
            <div class="video-list" id="videoList"></div>
            
            <script>
                fetch('/api/videos')
                    .then(response => response.json())
                    .then(videos => {
                        const container = document.getElementById('videoList');
                        
                        videos.forEach(video => {
                            const item = document.createElement('div');
                            item.className = 'video-item';
                            item.innerHTML = \`
                                <img src="\${video.thumbnail}" class="video-thumbnail">
                                <div class="video-title">\${video.name}</div>
                            \`;
                            item.addEventListener('click', () => {
                                window.location.href = video.watchUrl;
                            });
                            container.appendChild(item);
                        });
                    })
                    .catch(error => {
                        console.error('Erro ao carregar vídeos:', error);
                        document.getElementById('videoList').innerHTML = 
                            '<p>Erro ao carregar lista de vídeos</p>';
                    });
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
