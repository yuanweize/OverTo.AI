import { AnalysisWorkspace } from '@/components/AnalysisWorkspace';
import { aiAvailableFor } from '@/server/ai/availability';
export default async function AnalyzePage() { return <AnalysisWorkspace aiAvailable={await aiAvailableFor(false)} />; }
