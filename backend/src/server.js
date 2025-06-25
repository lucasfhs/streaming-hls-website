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

// Configurações para diferentes qualidades
const qualityProfiles = [
  {
    name: "360p",
    resolution: "640x360",
    bandwidth: "800000",
    masterPlaylistTag: "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360",
  },
  {
    name: "480p",
    resolution: "854x480",
    bandwidth: "1400000",
    masterPlaylistTag: "#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480",
  },
  {
    name: "720p",
    resolution: "1280x720",
    bandwidth: "2800000",
    masterPlaylistTag:
      "#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720",
  },
];

function ensureMultiQualityHLS(videoName) {
  return new Promise((resolve, reject) => {
    const inputVideo = path.join(videosDir, videoName);
    const videoBaseName = path.parse(videoName).name;
    const outputDir = path.join(outputBaseDir, videoBaseName);
    const masterPlaylistPath = path.join(outputDir, "master.m3u8");

    if (!fs.existsSync(inputVideo)) {
      return reject(new Error(`Vídeo original não encontrado: ${inputVideo}`));
    }

    // Verifica se todos os arquivos já existem
    const allQualitiesExist = qualityProfiles.every((quality) => {
      const playlistPath = path.join(outputDir, `${quality.name}.m3u8`);
      return fs.existsSync(playlistPath);
    });

    if (fs.existsSync(masterPlaylistPath)) {
      return resolve();
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Gera playlists para cada qualidade
    const conversionPromises = qualityProfiles.map((quality) => {
      return new Promise((resolveQuality, rejectQuality) => {
        const outputPlaylist = path.join(outputDir, `${quality.name}.m3u8`);

        exec(
          `ffmpeg -i "${inputVideo}" \
                  -profile:v baseline -level 3.0 \
                  -s ${quality.resolution} -start_number 0 \
                  -hls_time 10 -hls_list_size 0 \
                  -f hls "${outputPlaylist}"`,
          (err) => {
            if (err) {
              console.error(
                `Erro ao converter vídeo para ${quality.name}:`,
                err
              );
              rejectQuality(err);
            } else {
              console.log(
                `Arquivos HLS gerados para ${videoName} (${quality.name})`
              );
              resolveQuality();
            }
          }
        );
      });
    });

    // Quando todas as conversões estiverem prontas, cria o master playlist
    Promise.all(conversionPromises)
      .then(() => {
        // Cria o master playlist
        let masterPlaylistContent = "#EXTM3U\n";
        qualityProfiles.forEach((quality) => {
          masterPlaylistContent += `${quality.masterPlaylistTag}\n${quality.name}.m3u8\n`;
        });

        fs.writeFile(masterPlaylistPath, masterPlaylistContent, (err) => {
          if (err) {
            console.error("Erro ao criar master playlist:", err);
            reject(err);
          } else {
            console.log(`Master playlist criada para ${videoName}`);
            resolve();
          }
        });
      })
      .catch(reject);
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
      await ensureMultiQualityHLS(originalVideo);
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
    await ensureMultiQualityHLS(videoName);
    servePlayer(res, videoName);
  } catch (err) {
    console.error("Erro ao preparar vídeo:", err);
    res.status(500).send("Erro ao processar vídeo");
  }
});

function servePlayer(res, videoName) {
  const videoBaseName = path.parse(videoName).name;
  const hlsPath = `/streams/${videoBaseName}/master.m3u8`;

  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Player HLS: ${videoName}</title>
            <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
            <style>
                .player-container {
                    max-width: 1280px;
                    margin: 0 auto;
                    position: relative;
                }
                #video {
                    width: 100%;
                }
                .controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    background: #222;
                    color: white;
                }
                .settings-menu {
                    position: relative;
                    display: inline-block;
                }
                .settings-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 5px 10px;
                }
                .settings-content {
                    display: none;
                    position: absolute;
                    bottom: 40px;
                    right: 0;
                    background-color: #333;
                    min-width: 160px;
                    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
                    z-index: 1;
                    border-radius: 4px;
                    padding: 10px;
                }
                .settings-content.show {
                    display: block;
                }
                .quality-option {
                    color: white;
                    padding: 8px 16px;
                    text-decoration: none;
                    display: block;
                    cursor: pointer;
                }
                .quality-option:hover {
                    background-color: #444;
                }
                .quality-option.active {
                    color: #4CAF50;
                    font-weight: bold;
                }
                .current-quality {
                    margin-left: 10px;
                    font-size: 14px;
                    color: #aaa;
                }
            </style>
        </head>
        <body>
            <div class="player-container">
                <video id="video" controls></video>
                <div class="controls">
                    <div></div> <!-- Espaço vazio para alinhamento -->
                    <div class="settings-menu">
                        <button class="settings-btn" id="settingsBtn">
                            <i class="fas fa-cog"></i>
                            <span class="current-quality" id="currentQuality">Auto</span>
                        </button>
                        <div class="settings-content" id="settingsContent">
                            <div class="quality-option" data-quality="auto">Auto</div>
                            <!-- As opções de qualidade serão adicionadas dinamicamente -->
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                const video = document.getElementById('video');
                const settingsBtn = document.getElementById('settingsBtn');
                const settingsContent = document.getElementById('settingsContent');
                const currentQualityDisplay = document.getElementById('currentQuality');
                let hls;
                let availableQualities = [];
                let manualQuality = 'auto';
                
                // Função para inicializar o player
                function initPlayer() {
                    if (hls) {
                        hls.destroy();
                    }
                    
                    if (Hls.isSupported()) {
                        hls = new Hls({
                            enableWorker: true,
                            abrEwmaDefaultEstimate: 500000, // Estimativa inicial de banda (500kbps)
                            maxStarvationDelay: 4,          // Máximo atraso permitido antes de reduzir qualidade
                            maxLoadingDelay: 2,              // Máximo atraso de carregamento
                            abrBandWidthFactor: 0.95,       // Fator de segurança para estimativa de banda
                            abrBandWidthUpFactor: 0.7,      // Fator para considerar subir de qualidade
                            abrMaxWithRealBitrate: true,    // Usar bitrate real para decisão ABR
                        });
                        
                        hls.loadSource('${hlsPath}');
                        hls.attachMedia(video);
                        
                        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                            console.log('Manifesto carregado, qualidades disponíveis:', data.levels);
                            updateQualityOptions(data.levels);
                            video.play();
                        });
                        
                        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
                            if (manualQuality === 'auto') {
                                const level = hls.levels[data.level];
                                currentQualityDisplay.textContent = level ? level.height + 'p' : 'Auto';
                            }
                        });
                        
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = '${hlsPath}';
                        video.addEventListener('loadedmetadata', () => video.play());
                        // Para Safari (que tem HLS nativo), não temos controle sobre as qualidades
                        settingsBtn.style.display = 'none';
                    }
                }
                
                // Atualiza as opções de qualidade no menu
                function updateQualityOptions(levels) {
                    availableQualities = levels;
                    const settingsContent = document.getElementById('settingsContent');
                    
                    // Limpa as opções existentes (exceto "Auto")
                    while (settingsContent.children.length > 1) {
                        settingsContent.removeChild(settingsContent.lastChild);
                    }
                    
                    // Adiciona as novas opções
                    levels.forEach((level, index) => {
                        const option = document.createElement('div');
                        option.className = 'quality-option';
                        option.textContent = level.height + 'p';
                        option.dataset.quality = index;
                        option.addEventListener('click', () => {
                            setManualQuality(index);
                        });
                        settingsContent.appendChild(option);
                    });
                }
                
                // Define a qualidade manualmente
                function setManualQuality(quality) {
                    if (quality === 'auto') {
                        manualQuality = 'auto';
                        currentQualityDisplay.textContent = 'Auto';
                        hls.currentLevel = -1; // -1 significa auto
                    } else {
                        manualQuality = quality;
                        hls.currentLevel = quality;
                        currentQualityDisplay.textContent = hls.levels[quality].height + 'p';
                    }
                    
                    // Atualiza a classe 'active' nas opções
                    document.querySelectorAll('.quality-option').forEach(option => {
                        option.classList.toggle('active', 
                            (option.dataset.quality === quality.toString()) || 
                            (quality === 'auto' && option.dataset.quality === 'auto')
                        );
                    });
                }
                
                // Mostra/esconde o menu de configurações
                settingsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    settingsContent.classList.toggle('show');
                });
                
                // Fecha o menu quando clicar fora
                document.addEventListener('click', () => {
                    settingsContent.classList.remove('show');
                });
                
                // Inicializa o player
                initPlayer();
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
