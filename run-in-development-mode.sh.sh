#!/bin/bash

frontendPath="./frontend"
backendPath="./backend"

echo "Installing frontend dependencies..."
(cd "$frontendPath" && npm install)

echo "Installing backend dependencies..."
(cd "$backendPath" && npm install)

# Detecta se há terminal gráfico disponível
launch_in_terminal() {
  local dir="$1"
  local cmd="$2"
  
  if command -v gnome-terminal &> /dev/null; then
    gnome-terminal -- bash -c "cd $dir && $cmd; exec bash"
  elif command -v xfce4-terminal &> /dev/null; then
    xfce4-terminal --working-directory="$dir" -e "$cmd"
  elif command -v x-terminal-emulator &> /dev/null; then
    x-terminal-emulator -e bash -c "cd $dir && $cmd; exec bash"
  else
    echo "Running '$cmd' in background (mesmo terminal)..."
    (cd "$dir" && $cmd) &
  fi
}

echo "Starting frontend..."
launch_in_terminal "$frontendPath" "npm run dev"

echo "Starting backend..."
launch_in_terminal "$backendPath" "npm run dev"
