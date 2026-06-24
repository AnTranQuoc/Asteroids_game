class SoundManager {
  constructor() {
    this.sounds = {};
  }

  preloadSound(key, src) {
    this.sounds[key] = new Audio(src);
    this.sounds[key].preload = "auto";
  }

  playSound(key, volume = 0.1) {
    if (this.sounds[key]) {
      const sound = this.sounds[key];
      sound.currentTime = 0;
      sound.volume = volume;
      sound.play();
    }
  }
}

// Singleton instance
const soundManager = new SoundManager();

export default soundManager;
