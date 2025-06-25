import { useState, useEffect, useRef } from "react";
import * as AspectRatio from "@radix-ui/react-aspect-ratio";
import Hls from "hls.js";
import { FaCog } from "react-icons/fa";
import { capitalize } from "./utils/Capitalize";
type VideoContent = {
  name: string;
  thumbnail: string; // Base64 ou URL
  thumbnailUrl?: string; // Opcional
  watchUrl: string;
};

type QualityLevel = {
  height: number;
  width: number;
  bitrate: number;
  name?: string;
};

export default function App() {
  const [videos, setVideos] = useState<VideoContent[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hls, setHls] = useState<Hls | null>(null);
  const [availableQualities, setAvailableQualities] = useState<QualityLevel[]>(
    []
  );
  const [currentQuality, setCurrentQuality] = useState<string>("auto");
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);

  // Carrega a lista de vídeos da API
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/videos");
        if (!response.ok) {
          throw new Error("Failed to fetch videos");
        }
        const data = await response.json();
        setVideos(data);
        if (data.length > 0) {
          setSelectedVideo(data[0]);
        }
      } catch (err) {
        console.error("Error fetching videos:", err);
        setError("Failed to load videos. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideos();
  }, []);

  // Configura o player HLS e lida com as qualidades
  useEffect(() => {
    if (!selectedVideo || !videoRef.current) return;

    const videoElement = videoRef.current;

    if (hls) {
      hls.destroy();
    }

    // Extrai o nome do vídeo sem extensão
    const videoBaseName = selectedVideo.name.split(".").slice(0, -1).join(".");
    const hlsPath = `http://localhost:3000/streams/${videoBaseName}/master.m3u8`;

    if (Hls.isSupported()) {
      const newHls = new Hls({
        enableWorker: true,
        abrEwmaDefaultEstimate: 500000,
        maxStarvationDelay: 4,
        maxLoadingDelay: 2,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
        abrMaxWithRealBitrate: true,
      });

      newHls.loadSource(hlsPath);
      newHls.attachMedia(videoElement);

      newHls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log("Manifest loaded, available qualities:", data.levels);
        setAvailableQualities(data.levels);
        videoElement.play().catch((e) => console.log("Autoplay prevented:", e));
      });

      newHls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        if (currentQuality === "auto") {
          const level = newHls.levels[data.level];
          setCurrentQuality(level ? `${level.height}p` : "Auto");
        }
      });

      setHls(newHls);
    } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      // Fallback para Safari que tem suporte nativo a HLS
      videoElement.src = hlsPath;
      videoElement.addEventListener("loadedmetadata", () => {
        videoElement.play().catch((e) => console.log("Autoplay prevented:", e));
      });
      // Não podemos controlar as qualidades no Safari
      setAvailableQualities([]);
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [selectedVideo]);

  // Fecha o menu de qualidade quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        qualityMenuRef.current &&
        !qualityMenuRef.current.contains(event.target as Node)
      ) {
        setShowQualityMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const changeQuality = (quality: string | number) => {
    if (!hls) return;

    if (quality === "auto") {
      hls.currentLevel = -1; // -1 significa modo automático
      setCurrentQuality("Auto");
    } else if (typeof quality === "number") {
      hls.currentLevel = quality;
      const level = hls.levels[quality];
      setCurrentQuality(level ? `${level.height}p` : "Custom");
    }

    setShowQualityMenu(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center p-4 bg-gray-800 rounded-lg">
          <p className="text-red-500 mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">No videos available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">
      <header className="p-4 bg-black flex items-center justify-between shadow-md">
        <div className="flex items-center justify-center gap-2">
          <img
            src="ChatGPT Image 16 de jun. de 2025, 16_52_18.png"
            alt=""
            className="h-12 rounded-2xl"
          />
          <h1 className="text-2xl font-bold text-white michroma-regular">
            <span className="text-blue-500">HLS</span> Streaming
          </h1>
        </div>
      </header>

      <main className="flex flex-col md:flex-row gap-6 p-4 flex-1">
        {/* Main video player */}
        <div className="flex-1">
          <AspectRatio.Root
            ratio={16 / 9}
            className="bg-gray-800 rounded-xl overflow-hidden shadow-lg relative"
          >
            <video
              ref={videoRef}
              id="video-player"
              controls
              className="w-full h-full object-cover"
              poster={selectedVideo?.thumbnail}
            />

            {/* Botão de qualidade (só aparece se HLS for suportado e houver qualidades disponíveis) */}
            {Hls.isSupported() && availableQualities.length > 0 && (
              <div className="absolute bottom-16 right-4 z-10">
                <div className="relative" ref={qualityMenuRef}>
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="flex items-center gap-2 bg-black bg-opacity-70 px-3 py-1 rounded-md hover:bg-opacity-90 transition"
                  >
                    <FaCog />
                    <span>{currentQuality}</span>
                  </button>

                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 w-40 bg-gray-800 rounded-md shadow-lg overflow-hidden">
                      <div
                        onClick={() => changeQuality("auto")}
                        className={`px-4 py-2 cursor-pointer hover:bg-gray-700 ${
                          currentQuality === "Auto"
                            ? "text-blue-400 font-medium"
                            : ""
                        }`}
                      >
                        Auto
                      </div>
                      {availableQualities.map((level, index) => (
                        <div
                          key={index}
                          onClick={() => changeQuality(index)}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-700 ${
                            currentQuality === `${level.height}p`
                              ? "text-blue-400 font-medium"
                              : ""
                          }`}
                        >
                          {level.height}p
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </AspectRatio.Root>

          {selectedVideo && (
            <div className="mt-4">
              <h2 className="text-2xl font-semibold">
                {capitalize(selectedVideo.name.replace(/\.[^/.]+$/, ""))}
              </h2>
            </div>
          )}
        </div>

        {/* Thumbnails sidebar */}
        <div className="w-full md:w-1/3 space-y-4">
          <h3 className="text-lg font-medium">More to watch</h3>
          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {videos.map((video) => (
              <div
                key={video.name}
                onClick={() => setSelectedVideo(video)}
                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors
                  ${
                    selectedVideo?.name === video.name
                      ? "bg-gray-700 ring-2 ring-blue-500"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
              >
                <img
                  src={video.thumbnail}
                  alt={video.name}
                  className="w-16 h-16 object-cover rounded"
                />
                <div className="min-w-0">
                  <h4 className="font-semibold text-white truncate">
                    {capitalize(video.name.replace(/\.[^/.]+$/, ""))}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
