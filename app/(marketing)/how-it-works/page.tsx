export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-white mb-4">How It Works</h1>
        <p className="text-xl text-slate-400">Simple steps to pricing intelligence</p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">1</div>
          <h2 className="text-xl font-semibold text-white mb-2">Connect Your Store</h2>
          <p className="text-slate-400">Link your e-commerce platform</p>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">2</div>
          <h2 className="text-xl font-semibold text-white mb-2">Add Competitors</h2>
          <p className="text-slate-400">Track competitor prices automatically</p>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">3</div>
          <h2 className="text-xl font-semibold text-white mb-2">Get Recommendations</h2>
          <p className="text-slate-400">AI suggests optimal pricing</p>
        </div>
      </div>
    </div>
  );
}

