import type { JourneyState, RoutePlan } from './model';
export type MapProps = { plan: RoutePlan | null; state: JourneyState | null; dark: boolean; fitVersion: number; onError: (message: string) => void };
