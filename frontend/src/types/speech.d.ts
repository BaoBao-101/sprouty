/** The Web Speech API is still vendor-prefixed and not in TypeScript's DOM lib. */
declare global {
  interface Window {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  }
}

export {};
