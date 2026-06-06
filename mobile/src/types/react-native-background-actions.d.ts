declare module 'react-native-background-actions' {
  interface BackgroundTaskOptions {
    taskName: string;
    taskTitle: string;
    taskDesc: string;
    taskIcon: { name: string; type: string; package?: string };
    color?: string;
    linkingURI?: string;
    progressBar?: { max: number; value: number; indeterminate?: boolean };
    foregroundServiceType?: Array<
      | 'dataSync'
      | 'mediaPlayback'
      | 'phoneCall'
      | 'location'
      | 'connectedDevice'
      | 'mediaProjection'
      | 'camera'
      | 'microphone'
      | 'health'
      | 'remoteMessaging'
      | 'systemExempted'
      | 'shortService'
      | 'specialUse'
    >;
    parameters?: any;
  }

  class BackgroundServer {
    isRunning(): boolean;
    start(
      task: (taskData?: any) => Promise<void>,
      options: BackgroundTaskOptions
    ): Promise<void>;
    stop(): Promise<void>;
    updateNotification(taskData: Partial<BackgroundTaskOptions>): Promise<void>;
    on(event: 'expiration', listener: () => void): this;
  }

  const backgroundServer: BackgroundServer;
  export default backgroundServer;
}
