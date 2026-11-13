export interface CronOptions {
    name?: string;
    scheduled?: boolean;
    recoverMissedExecutions?: boolean;
    timezone?: string;
    runOnInit?: boolean;
}
