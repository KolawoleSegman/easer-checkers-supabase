import { Audio } from 'expo-av';

type SoundName = 'move' | 'capture' | 'win' | 'lose';

const sources: Record<SoundName, any> = {
  move: require('../../assets/sounds/move.mp3'),
  capture: require('../../assets/sounds/capture.mp3'),
  win: require('../../assets/sounds/win.mp3'),
  lose: require('../../assets/sounds/lose.mp3'),
};

let enabled = true;
const cache: Partial<Record<SoundName, Audio.Sound>> = {};

export function setSoundsEnabled(value: boolean) {
  enabled = value;
}

export function areSoundsEnabled() {
  return enabled;
}

async function load(name: SoundName): Promise<Audio.Sound | null> {
  try {
    if (cache[name]) return cache[name]!;
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    const { sound } = await Audio.Sound.createAsync(sources[name], {
      shouldPlay: false,
      volume: 0.85,
    });
    cache[name] = sound;
    return sound;
  } catch {
    return null;
  }
}

export async function playSound(name: SoundName) {
  if (!enabled) return;
  try {
    const sound = await load(name);
    if (!sound) return;
    await sound.replayAsync();
  } catch {
    // Ignore audio errors on simulators / restricted devices
  }
}

export async function unloadSounds() {
  for (const s of Object.values(cache)) {
    try {
      await s?.unloadAsync();
    } catch {
      /* ignore */
    }
  }
  for (const k of Object.keys(cache) as SoundName[]) delete cache[k];
}
