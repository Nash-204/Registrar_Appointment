import { FileText, Target, Eye, Clock, CalendarDays, Users, Pencil, FileCheck } from 'lucide-react';

import { site } from '../siteConfig.js';

const services = [
  {
    icon: FileText,
    title: 'Civil Registration',
    description:
      'Registration of births, deaths, and marriages, including late registration and out-of-town filings.',
  },
  {
    icon: FileCheck,
    title: 'Certified Copies',
    description:
      'Request certified copies of birth, death, and marriage records.',
  },
  {
    icon: Pencil,
    title: 'Corrections and Supplemental Reports',
    description:
      'Correct errors in civil registry entries or submit supplemental reports for missing information.',
  },
  {
    icon: Users,
    title: 'Acknowledgment and Legitimation',
    description:
      'Assistance with documents that recognize or legitimize a child under the law.',
  },
];

// `dark` uses the bright gold so the label stays readable on navy backgrounds.
const Eyebrow = ({ children, dark }) => (
  <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] ${dark ? 'text-seal' : 'text-sealdark'}`}>
    <span className={`h-0.5 w-10 ${dark ? 'bg-seal' : 'bg-sealdark'}`} />
    {children}
  </p>
);

export default function About() {
  return (
    <div className="bg-paper text-ink">
      {/* Page Header */}
      <section className="bg-navy-deep text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <Eyebrow dark>Get to know us</Eyebrow>

          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
            About the Civil Registry Office
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-white/85 md:text-lg">
            We preserve important life records through accurate registration
            and provide reliable, courteous service to the community.
          </p>
        </div>
      </section>

      {/* About the Office */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="grid items-start gap-10 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <div>
            <Eyebrow>Who we are</Eyebrow>

            <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
              Serving Our Community
            </h2>
          </div>

          <div className="space-y-4 text-base leading-8 text-ink/75">
            <p>
              The Civil Registry Office maintains records of births, deaths,
              and marriages within its jurisdiction. These documents help
              establish identity, family relationships, and eligibility for
              various legal rights and public services.
            </p>

            <p>
              We are committed to helping residents with civil registration,
              document requests, and corrections through an organized,
              accessible, and efficient public service.
            </p>
          </div>
        </div>
      </section>

      {/* Mission and Vision */}
      <section className="bg-mist">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-2xl">
            <Eyebrow>Our purpose and direction</Eyebrow>

            <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
              Our Mission and Vision
            </h2>

            <p className="mt-4 leading-7 text-ink/70">
              Guided by accuracy, integrity, and commitment to public service,
              we work to protect civil records and serve every resident
              with care.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Mission Card */}
            <article className="rounded-2xl border border-ink/10 bg-white p-7 shadow-sm transition-shadow hover:shadow-md md:p-9">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-seal">
                <Target size={27} className="text-ink" />
              </div>

              <h3 className="mt-6 text-2xl font-semibold">
                Our Mission
              </h3>

              <p className="mt-4 leading-8 text-ink/75 text-center">
                To advocate the paradigm of a streamlined and equitable civil registration system 
                by inculcating therein the disipline and professionalism for efficient civil registry system. 
                Likewise, to serve our constituents with equal treatment and promptness.
              </p>
            </article>

            {/* Vision Card */}
            <article className="rounded-2xl border border-ink/10 bg-white p-7 shadow-sm transition-shadow hover:shadow-md md:p-9">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-seal">
                <Eye size={27} className="text-ink" />
              </div>

              <h3 className="mt-6 text-2xl font-semibold">
                Our Vision
              </h3>

              <p className="mt-4 leading-8 text-ink/75 text-center">
                Towards a very dynamic city, the entire staff adheres to a more efficient, 
                effective and highly responsive system service rendered and the realization of Customer Satisfaction.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <Eyebrow>What we offer</Eyebrow>

          <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
            Our Services
          </h2>

          <p className="mt-4 max-w-xl leading-7 text-ink/70">
            We provide civil registry services to help residents manage
            important records and documentation.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {services.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="group flex items-start gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-seal">
                  <Icon size={22} />
                </span>

                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/70">
                    {description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Office Hours */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:py-16">
          <div>
            <Eyebrow dark>
              Plan your visit
            </Eyebrow>

            <h2 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
              We're Here to Help
            </h2>

            <p className="mt-4 max-w-md leading-7 text-white/80">
              Visit our office during regular business hours for assistance
              with your civil registry needs.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-seal text-ink">
                <CalendarDays size={22} />
              </span>

              <div>
                <h3 className="font-semibold text-white">
                  Office Hours
                </h3>

                <p className="mt-2 text-white/80">
                  {site.officeHours}
                </p>

                <div className="mt-4 flex items-center gap-2 text-sm text-white/70">
                  <Clock size={16} className="text-seal" />
                  Appointment hours: {site.appointmentHours}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
