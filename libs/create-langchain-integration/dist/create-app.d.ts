export type InstallAppArgs = {
    appPath: string;
};
export declare function createApp({ appPath }: InstallAppArgs): Promise<void>;
