import { NewInspectionPicker } from './NewInspectionPicker';

export const dynamic = 'force-dynamic';

export default function NewInspectionPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">New inspection</h1>
      <p className="text-sm text-slate-500 mt-0.5">Choose how you want to author this inspection.</p>
      <NewInspectionPicker />
    </div>
  );
}
