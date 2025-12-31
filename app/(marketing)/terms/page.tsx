export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
        <div className="prose prose-invert max-w-none">
          <div className="bg-slate-900/80 rounded-2xl p-8 space-y-6 text-slate-300">
            <p className="text-slate-400">
              Last updated: {new Date().toLocaleDateString()}
            </p>
            
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using PricePilot, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Use License</h2>
              <p>
                Permission is granted to temporarily use PricePilot for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or for any public display</li>
                <li>Attempt to reverse engineer any software contained on PricePilot</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Service Availability</h2>
              <p>
                We strive to provide reliable service, but we do not guarantee that the service will be available at all times. We reserve the right to modify or discontinue the service at any time without notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. User Responsibilities</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Limitation of Liability</h2>
              <p>
                In no event shall PricePilot or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on PricePilot.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Contact Information</h2>
              <p>
                If you have any questions about these Terms of Service, please contact us through our support channels.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

