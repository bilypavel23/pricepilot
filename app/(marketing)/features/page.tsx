export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-white mb-4">Features</h1>
        <p className="text-xl text-slate-400">Everything you need to stay competitive</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-2">Competitor Tracking</h2>
          <p className="text-slate-400">Monitor competitor prices in real-time</p>
        </div>
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-2">Price Recommendations</h2>
          <p className="text-slate-400">AI-powered pricing suggestions</p>
        </div>
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-2">Automated Sync</h2>
          <p className="text-slate-400">Keep your prices updated automatically</p>
        </div>
      </div>
    </div>
  );
}


