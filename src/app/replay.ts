export type PlaybackSpeed = 0.5 | 1 | 2 | 4;
export interface ReplayState {
  readonly cursor: number;
  readonly playing: boolean;
  readonly speed: PlaybackSpeed;
}
export type ReplayAction =
  | { type: 'play' | 'pause' | 'previous' | 'next' | 'tick' | 'reset' }
  | { type: 'speed'; speed: PlaybackSpeed }
  | { type: 'seek'; cursor: number };
export const initialReplay: ReplayState = {
  cursor: 0,
  playing: false,
  speed: 1,
};

export function replayReducer(
  state: ReplayState,
  action: ReplayAction,
  frameCount: number,
): ReplayState {
  const last = Math.max(0, frameCount - 1);
  switch (action.type) {
    case 'play':
      return {
        ...state,
        cursor: state.cursor >= last ? 0 : state.cursor,
        playing: frameCount > 1,
      };
    case 'pause':
      return { ...state, playing: false };
    case 'previous':
      return {
        ...state,
        cursor: Math.max(0, state.cursor - 1),
        playing: false,
      };
    case 'next':
      return {
        ...state,
        cursor: Math.min(last, state.cursor + 1),
        playing: false,
      };
    case 'tick': {
      if (!state.playing) return state;
      const cursor = Math.min(last, state.cursor + 1);
      return { ...state, cursor, playing: cursor < last };
    }
    case 'reset':
      return { ...state, cursor: 0, playing: false };
    case 'speed':
      return { ...state, speed: action.speed };
    case 'seek':
      return Number.isInteger(action.cursor)
        ? {
            ...state,
            cursor: Math.max(0, Math.min(last, action.cursor)),
            playing: false,
          }
        : state;
  }
}
