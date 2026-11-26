// The game's state machine: title (mission select), briefing, flying, paused and debrief. Each
// screen is one value; transitions are explicit helpers so main.js only has to ask "what screen am
// I on" and "go to the next one". The state also holds which mission is loaded and the last result.

export const SCREEN = {
  TITLE: 'title',
  BRIEFING: 'briefing',
  FLYING: 'flying',
  PAUSED: 'paused',
  DEBRIEF: 'debrief',
};

export function createState() {
  return {
    screen: SCREEN.TITLE,
    missionIndex: 0,
    result: null, // { time, fuel, grade, damage, score, complete }
    cameraMode: 'chase',

    setScreen(s) {
      this.screen = s;
    },
    isFlying() {
      return this.screen === SCREEN.FLYING;
    },
  };
}