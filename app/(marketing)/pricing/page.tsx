export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-white mb-4">Pricing</h1>
        <p className="text-xl text-slate-400">Choose the plan that fits your needs</p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="p-8 rounded-xl bg-slate-900/50 border border-slate-800">
          <h2 className="text-2xl font-semibold text-white mb-2">Starter</h2>
          <p className="text-3xl font-bold text-white mb-4">$29<span className="text-lg text-slate-400">/mo</span></p>
          <ul className="space-y-2 text-slate-400">
            <li>Up to 50 products</li>
            <li>Basic competitor tracking</li>
            <li>Email support</li>
          </ul>
        </div>
        <div className="p-8 rounded-xl bg-blue-900/50 border-2 border-blue-500">
          <h2 className="text-2xl font-semibold text-white mb-2">Pro</h2>
          <p className="text-3xl font-bold text-white mb-4">$79<span className="text-lg text-slate-400">/mo</span></p>
          <ul className="space-y-2 text-slate-400">
            <li>Up to 150 products</li>
            <li>Advanced tracking</li>
            <li>Priority support</li>
          </ul>
        </div>
        <div className="p-8 rounded-xl bg-slate-900/50 border border-slate-800">
          <h2 className="text-2xl font-semibold text-white mb-2">Scale</h2>
          <p className="text-3xl font-bold text-white mb-4">$199<span className="text-lg text-slate-400">/mo</span></p>
          <ul className="space-y-2 text-slate-400">
            <li>Unlimited products</li>
            <li>Enterprise features</li>
            <li>Dedicated support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


