interface CopyOption {
    cwd?: string;
    rename?: (basename: string) => string;
    parents?: boolean;
}
export declare const copy: (src: string | string[], dest: string, { cwd, rename, parents }?: CopyOption) => Promise<void[]>;
export {};
