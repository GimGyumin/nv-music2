let sharedAudio: HTMLAudioElement | null = null;

export function getSharedAudio(): HTMLAudioElement {
  if (sharedAudio) return sharedAudio;

  const audio = document.createElement('audio');
  audio.preload = 'auto';
  try { (audio as any).playsInline = true; } catch (e) {}
  audio.crossOrigin = 'anonymous';
  audio.style.position = 'fixed';
  audio.style.left = '-9999px';
  audio.style.width = '1px';
  audio.style.height = '1px';
  audio.style.opacity = '0';
  document.body.appendChild(audio);
  sharedAudio = audio;
  return sharedAudio;
}

export function removeSharedAudio() {
  if (!sharedAudio) return;
  try {
    sharedAudio.pause();
  } catch (e) {}
  try {
    if (sharedAudio.parentNode) sharedAudio.parentNode.removeChild(sharedAudio);
  } catch (e) {}
  sharedAudio = null;
}
