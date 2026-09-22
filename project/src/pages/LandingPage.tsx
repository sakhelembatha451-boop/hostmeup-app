import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

const HERO_IMG = 'https://images.pexels.com/photos/1066171/pexels-photo-1066171.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800';

const FEATURED = [
  { name: 'Sofia Chen', role: 'Singer / Vocalist', location: '', img: 'https://images.pexels.com/photos/8412351/pexels-photo-8412351.jpeg?auto=compress&cs=tinysrgb&h=900&w=600' },
  { name: 'Marcus Ray', role: 'Producer / Sound Engineer', location: '', img: 'https://images.pexels.com/photos/8132801/pexels-photo-8132801.jpeg?auto=compress&cs=tinysrgb&h=900&w=600' },
  { name: 'Elena Voss', role: 'Model', location: '', img: 'https://images.pexels.com/photos/24972993/pexels-photo-24972993.jpeg?auto=compress&cs=tinysrgb&h=900&w=600' },
  { name: 'Aria Kim', role: 'Beauty Professional', location: '', img: 'https://images.pexels.com/photos/19301071/pexels-photo-19301071.jpeg?auto=compress&cs=tinysrgb&h=900&w=600' },
  { name: 'James Cole', role: 'Photographer / Videographer', location: '', img: 'https://images.pexels.com/photos/30681560/pexels-photo-30681560.jpeg?auto=compress&cs=tinysrgb&h=900&w=600' },
  { name: 'Nia Okafor', role: 'Live Performer / DJ', location: '', img: 'https://images.pexels.com/photos/6398745/pexels-photo-6398745.jpeg?auto=compress&cs=tinysrgb&h=900&w=600' },
];

const CATEGORIES = [
  { label: 'Singer / Vocalist', img: 'https://images.pexels.com/photos/8412349/pexels-photo-8412349.jpeg?auto=compress&cs=tinysrgb&h=600&w=400' },
  { label: 'Producer / Sound Engineer', img: 'https://images.pexels.com/photos/8132966/pexels-photo-8132966.jpeg?auto=compress&cs=tinysrgb&h=600&w=400' },
  { label: 'Live Performer / DJ', img: 'https://images.pexels.com/photos/14646763/pexels-photo-14646763.jpeg?auto=compress&cs=tinysrgb&h=600&w=400' },
  { label: 'Beauty Professional', img: 'https://images.pexels.com/photos/30068114/pexels-photo-30068114.jpeg?auto=compress&cs=tinysrgb&h=600&w=400' },
  { label: 'Model', img: 'https://images.pexels.com/photos/3153460/pexels-photo-3153460.jpeg?auto=compress&cs=tinysrgb&h=600&w=400' },
  { label: 'Photographer / Videographer', img: 'https://images.pexels.com/photos/33419101/pexels-photo-33419101.jpeg?auto=compress&cs=tinysrgb&h=600&w=400' },
];

export default function LandingPage() {
  const { session } = useAuth();
  const ctaTo = session ? '/artists' : '/signup';
  const ctaLabel = session ? 'Browse Talent' : 'Get Started';

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero — split editorial layout */}
      <section className="border-b border-line">
        <div className="max-w-editorial mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-[80vh] items-stretch">
            {/* Left: text */}
            <div className="lg:col-span-7 flex flex-col justify-center py-16 lg:py-0 lg:pr-16">
              <div className="animate-slide-up">
                <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-6">— The Talent Directory</p>
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold text-ink leading-[0.95] mb-8 text-balance">
                  Where creative talent meets the perfect stage.
                </h1>
                <p className="text-lg text-ink-500 max-w-md leading-relaxed mb-10">
                  A curated directory of singers, producers, performers, models, photographers, and beauty professionals — bookable directly for your next event.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to={ctaTo} aria-label={ctaLabel} className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-sm uppercase tracking-wide-sm">
                    {ctaLabel}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/artists" aria-label="Explore the talent directory" className="btn-outline inline-flex items-center gap-2 px-8 py-4 text-sm uppercase tracking-wide-sm">
                    Explore Directory
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: full-bleed image */}
            <div className="lg:col-span-5 relative overflow-hidden bg-paper-300 min-h-[50vh] lg:min-h-0">
              <img src={HERO_IMG} alt="Creative talent performing on stage under dramatic lighting" width={800} height={1200} className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Featured talent — editorial grid */}
      <section className="border-b border-line">
        <div className="max-w-editorial mx-auto px-6 lg:px-12 py-20">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Featured</p>
              <h2 className="font-display text-4xl lg:text-5xl font-bold text-ink">The Roster</h2>
            </div>
            <Link to="/artists" aria-label="View all featured talent" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink uppercase tracking-wide-sm transition-colors">
              View All <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-x-6 gap-y-12">
            {FEATURED.map((person, i) => (
              <Link key={i} to="/artists" className="group block animate-fade-in" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="relative overflow-hidden bg-paper-300 mb-4 aspect-[3/4]">
                  <img src={person.img} alt={person.name} width={600} height={900} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-ink group-hover:text-accent transition-colors">{person.name}</h3>
                    <p className="text-sm text-ink-400 mt-0.5">{person.role}</p>
                  </div>
                  {person.location && (
                    <span className="text-xs uppercase tracking-wide-sm text-ink-300">{person.location}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center sm:hidden">
            <Link to="/artists" aria-label="View all talent" className="btn-outline px-8 py-3.5 text-xs uppercase tracking-wide-sm">View All Talent</Link>
          </div>
        </div>
      </section>

      {/* Categories — full-bleed strip */}
      <section className="border-b border-line bg-paper-200">
        <div className="max-w-editorial mx-auto px-6 lg:px-12 py-20">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Categories</p>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-ink">Six disciplines. One directory.</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {CATEGORIES.map((cat, i) => (
              <Link key={i} to="/artists" className="group block animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="relative overflow-hidden bg-paper-300 mb-3 aspect-[3/4]">
                  <img src={cat.img} alt={cat.label} width={400} height={600} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <h3 className="text-xs font-medium text-ink-600 group-hover:text-accent transition-colors leading-tight">{cat.label}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — editorial two-column */}
      <section className="border-b border-line">
        <div className="max-w-editorial mx-auto px-6 lg:px-12 py-20">
          <div className="mb-16">
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— How It Works</p>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-ink">Two paths. One platform.</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* For Hosts */}
            <div className="border-l border-line pl-8">
              <h3 className="font-display text-2xl font-semibold text-ink mb-6">For Hosts</h3>
              <ul className="space-y-5">
                {[
                  'Browse the full talent directory with portfolios, media, and rates',
                  'Send detailed booking requests with event specifics and equipment needs',
                  'Track every request from a single, unified dashboard',
                  'Receive real-time accept or decline responses',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="font-display text-2xl text-ink-200 font-light tabular-nums flex-shrink-0 w-8">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-ink-600 leading-relaxed pt-1">{item}</span>
                  </li>
              {/* Stats strip */}
      <section className="border-b border-line">
        <div className="max-w-editorial mx-auto px-6 lg:px-12 py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
            { value: '6+', label: 'Versatile Categories' },
{ value: '2 Min', label: 'Fast Verification' },
{ value: 'Direct', label: 'Host Connections' },
{ value: '100%', label: 'Vetted Profiles' },
              
            ].map((stat, i) => (
              <div key={i} className="text-center lg:text-left">
                <div className="font-display text-5xl lg:text-6xl font-bold text-ink mb-2">{stat.value}</div>
                <div className="text-xs uppercase tracking-wide-sm text-ink-400">{stat.label}</div>
              </div>
            )}
          </div>
        </div>
      </section> 
        </div>
      </section>
                    <span className="text-ink-600 leading-relaxed pt-1">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-line">
        <div className="max-w-editorial mx-auto px-6 lg:px-12 py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
            {[
              { value: '500+', label: 'Talents' },
              { value: '1,200+', label: 'Events Booked' },
              { value: '6', label: 'Categories' },
              { value: '4.9', label: 'Avg. Rating' },
            ].map((stat, i) => (
              <div key={i} className="text-center lg:text-left">
                <div className="font-display text-5xl lg:text-6xl font-bold text-ink mb-2">{stat.value}</div>
                <div className="text-xs uppercase tracking-wide-sm text-ink-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="max-w-editorial mx-auto px-6 lg:px-12 py-24 text-center">
          <h2 className="font-display text-4xl lg:text-6xl font-bold mb-6 text-balance">Ready to find your next creative professional?</h2>
          <p className="text-lg text-paper/60 max-w-xl mx-auto mb-10">Join HostMeUp today — whether you're looking to book talent or get booked.</p>
          <Link to={ctaTo} aria-label={ctaLabel} className="inline-flex items-center gap-2 px-10 py-4 bg-paper text-ink font-medium text-sm uppercase tracking-wide-sm hover:bg-paper-300 transition-colors rounded-none">
            {ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
