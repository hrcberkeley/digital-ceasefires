// The About page. Its body is one Markdown row in site_text (about.body); the
// literal below is the same text, used only if that row is missing.
import { h, renderMarkdown } from "../utils.js";
import { t } from "../data.js";

const ABOUT_BODY_FALLBACK = `The Digital Ceasefire & De-escalation Handbook provides a practical framework for mediators, negotiators, and affected communities to negotiate, draft, and implement ceasefire, de-escalation, and other agreements that constrain digital operations in conflict and other security contexts.

Developed in response to the accelerating digitalization of warfare, the Platform addresses the urgent need to confront hostile digital operations. Ceasefire agreements have traditionally overlooked the digital dimensions of conflict, leaving gaps in civilian protection and allowing unconstrained digital operations to take place.

The Platform addresses three interconnected dimensions of digital warfare: Internet Interference; Information Threats; and Cyber Attacks. It places the experiences and protection of conflict-affected populations at the center of its approach.

Grounded in International Law, including International Humanitarian Law, International Human Rights Law, and International Criminal Law, the Platform recognizes the challenges of applying existing legal frameworks to evolving digital threats. While Parties remain bound by their obligations under International Law, the Platform enables them to negotiate additional commitments to restrain and de-escalate digital operations that may otherwise be lawful.

At its core is the Digital Ceasefire & De-escalation Handbook, a living resource designed to evolve alongside technological developments, emerging threats, and lessons from practice. Rather than prescribing a single solution, the Handbook offers a flexible menu of model provisions that Parties can select, adapt, and combine to develop agreements tailored to different conflict and security contexts.

Through the Platform's [Build an Agreement function](#/builder), users can construct customized agreements using the Handbook's model provisions. The [Note to Users](#/handbook/s-note-to-users) provides useful background to constructing an Agreement. Alternatively, the [entire handbook](#/handbook) can be read and used here as a guide to support and contribute to existing negotiations.

### Background to the Platform

The [Digital Ceasefire & De-escalation Platform](https://humanrights.berkeley.edu/projects/digital-ceasefire-and-de-escalation-handbook/) is an initiative of the [Human Rights Center](https://humanrights.berkeley.edu/) at the University of California, Berkeley School of Law, and is co-led by Senior Research Fellow [Brett Solomon](https://humanrights.berkeley.edu/people/brett-solomon/) and Executive Director [Betsy Popken](https://humanrights.berkeley.edu/people/betsy-popken/). The Handbook has been informed by research, consultations, and engagement with experts and practitioners working across conflict mediation and negotiation, international law, human rights, humanitarian protection, and digital technologies.

The initiative seeks to bridge the gap between the rapidly evolving realities of digital warfare and the practical tools available to those working to prevent conflict, reduce hostilities, protect civilians, and advance Digital Peace.

The Digital Ceasefire team is available to provide advice, technical assistance, briefings, training, and support to mediators, negotiators, civil society organizations, and others addressing the digital dimensions of conflict.

The website was created by the Investigations Lab, Human Rights Center. **AI Disclosure:** This platform was created using a combination of cloud and local models and LLM harnesses. All the text was produced by humans.

Contact: Betsy Popken at [bpopken@berkeley.edu](mailto:bpopken@berkeley.edu) or Brett Solomon at [solomonbrett@gmail.com](mailto:solomonbrett@gmail.com)

[Explore the Handbook](#/handbook) | [Build an Agreement](#/builder) | [Request Support](mailto:bpopken@berkeley.edu)`;

export function renderAbout({ mountEl, db }) {
  mountEl.appendChild(
    h("div", { className: "container section-pad" }, [
      h("h1", {}, t(db, "about.title", "About")),
      h("div", { className: "prose", html: renderMarkdown(t(db, "about.body", ABOUT_BODY_FALLBACK)) }),
    ])
  );
}
