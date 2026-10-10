import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowForward from "@mui/icons-material/ArrowForward";
import BadgeOutlined from "@mui/icons-material/BadgeOutlined";
import Check from "@mui/icons-material/Check";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ConfirmationNumberOutlined from "@mui/icons-material/ConfirmationNumberOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import EditNoteOutlined from "@mui/icons-material/EditNoteOutlined";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import { Button } from "@mui/material";
import styles from "@/features/landing/landing.module.css";
import { LandingMotion } from "@/features/landing/landing-motion";

const capabilities = [
  {
    icon: EditNoteOutlined,
    title: "A page that feels like your event",
    text: "Bring your event to life with a cropped cover, formatted description, schedule, venue or online location, and organizer details.",
    label: "EVENT PAGES",
  },
  {
    icon: TuneOutlined,
    title: "Ask the questions that matter",
    text: "Build your registration form with text, choice and checkbox fields. Set required answers, capacity and an application window.",
    label: "CUSTOM FORMS",
  },
  {
    icon: GroupsOutlined,
    title: "The right access for your team",
    text: "Bring in Managers to help review applications and Reception staff to welcome attendees. Each role gets the tools it needs.",
    label: "TEAMWORK",
  },
  {
    icon: EmailOutlined,
    title: "Keep everyone in the loop",
    text: "Application updates go out by email. Send a message to attendees, pending applicants or your event team, and review delivery status.",
    label: "COMMUNICATIONS",
  },
  {
    icon: BadgeOutlined,
    title: "Ready for the welcome desk",
    text: "Create printable badges, scan QR tickets or check people in manually. See who has arrived in your event workspace.",
    label: "EVENT DAY",
  },
  {
    icon: ContentCopyOutlined,
    title: "Make the next one easier",
    text: "Duplicate an event or reuse its configuration with templates. Export application and attendee data when you need to work with it elsewhere.",
    label: "REPEAT & REFINE",
  },
];

const questions = [
  {
    title: "Can I review applications before admitting people?",
    answer:
      "Yes. Submissions arrive as pending applications. An organizer or authorized Manager reviews them, and approval grants admission and creates a ticket. A submitted application alone does not reserve a place.",
  },
  {
    title: "Do attendees need an Event Flow account?",
    answer:
      "You choose. Events can accept applications without an account or require a verified account. Approved anonymous applicants receive a private ticket link by email.",
  },
  {
    title: "Can I keep an event out of the public catalog?",
    answer:
      "Yes. Publish it as Private to exclude it from discovery. People with its direct link can still view it; Private is not password protection.",
  },
  {
    title: "What happens when I edit a published event?",
    answer:
      "Your edits stay in the organizer workspace until you publish the changes. You can preview the updated event and registration form before making them public.",
  },
  {
    title: "Can my team help at the event?",
    answer:
      "Yes. Assign Manager or Reception access to verified users. Managers can review applications and handle check-in; Reception staff get access to the arrival workflow.",
  },
];

export function LandingPage({
  organizerHref,
  organizer,
  signedIn,
}: {
  organizerHref: string;
  organizer: boolean;
  signedIn: boolean;
}) {
  const organizerLabel = organizer ? "Open your workspace" : "Start organizing";

  return (
    <div className={styles.landing}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <LandingMotion className={styles.heroCopy} variant="hero">
          <div className={styles.eyebrow}>
            <span className={styles.signal} /> YOUR EVENT. ONE CONNECTED
            WORKSPACE.
          </div>
          <h1 id="landing-title">
            Bring people
            <br />
            together.
            <br />
            <span>
              We’ll help with
              <br className={styles.desktopBreak} /> the details.
            </span>
          </h1>
          <p className={styles.lead}>
            From a page worth sharing to the last check-in. Publish your event,
            review applications and welcome your community with Event Flow.
          </p>
          <div className={styles.actions}>
            <Button
              href={organizerHref}
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
            >
              {organizerLabel}
            </Button>
            <Button href="/e" variant="outlined" size="large">
              Explore events
            </Button>
          </div>
          <a href="#how-it-works" className={styles.sectionLink}>
            See how it all connects <ArrowDownward fontSize="small" />
          </a>
        </LandingMotion>
        <LandingMotion className={styles.flow} variant="flow">
          <div className={styles.flowHeader}>
            <span className={styles.eyebrow}>THE EVENT FLOW</span>
            <span className={styles.flowMarker}>IDEA → ARRIVAL</span>
          </div>
          <div className={styles.flowTrack}>
            <span
              className={styles.flowProgress}
              data-flow-progress
              aria-hidden="true"
            />
            {[
              {
                icon: EventAvailableOutlined,
                number: "01",
                title: "Make it yours",
                detail: "Your page. Your form. Your schedule.",
                status: "Ready to publish",
              },
              {
                icon: FactCheckOutlined,
                number: "02",
                title: "Bring the right people",
                detail: "Applications, review and admission.",
                status: "You’re in control",
              },
              {
                icon: ConfirmationNumberOutlined,
                number: "03",
                title: "Give them a way in",
                detail: "An individual QR ticket on approval.",
                status: "Ready to attend",
              },
              {
                icon: QrCodeScannerOutlined,
                number: "04",
                title: "Make the welcome count",
                detail: "Check-in, badges and your event team.",
                status: "All in one place",
              },
            ].map(({ icon: Icon, number, title, detail, status }) => (
              <div key={number} className={styles.flowStep} data-flow-step>
                <span className={styles.flowNumber} data-flow-number>
                  {number}
                </span>
                <div className={styles.flowCard} data-flow-card>
                  <Icon className={styles.flowIcon} />
                  <div>
                    <h2>{title}</h2>
                    <p>{detail}</p>
                    <span className={styles.flowStatus} data-flow-status>
                      <Check sx={{ fontSize: 14 }} /> {status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className={styles.flowFooter}>
            Less switching between tools. More room for people.
          </p>
        </LandingMotion>
      </section>

      <nav className={styles.contents} aria-label="Discover Event Flow">
        <a href="#how-it-works">
          01 <span>How it works</span>
        </a>
        <a href="#features">
          02 <span>Your toolkit</span>
        </a>
        <a href="#for-attendees">
          03 <span>For attendees</span>
        </a>
        <a href="#questions">
          04 <span>Good to know</span>
        </a>
      </nav>

      <section
        id="how-it-works"
        className={styles.section}
        aria-labelledby="workflow-title"
      >
        <LandingMotion className={styles.sectionHeading} variant="heading">
          <div>
            <p className={styles.eyebrow}>FROM PLANNING TO PEOPLE</p>
            <h2 id="workflow-title">
              A clear next step.
              <br />
              At every stage.
            </h2>
          </div>
          <p className={styles.sectionIntro}>
            Your event changes as the day gets closer. Keep the planning,
            admission and arrival work connected from the start.
          </p>
        </LandingMotion>
        <div className={styles.stages}>
          {[
            {
              number: "01",
              title: "Prepare with confidence",
              text: "Start in a draft. Add the details, build your form and preview the experience. Publish when everything is ready.",
              points: [
                "A cover and schedule that tell your story",
                "Public discovery or a private direct link",
                "Changes go live only when you publish",
              ],
            },
            {
              number: "02",
              title: "Know who’s coming",
              text: "Collect the answers you need, review applications and approve people as places become available.",
              points: [
                "Required and optional form questions",
                "Application review and capacity control",
                "Tickets and email updates after approval",
              ],
            },
            {
              number: "03",
              title: "Be ready at the door",
              text: "Give your team a shared workspace for arrivals. Scan a ticket, find an attendee or print a badge.",
              points: [
                "Online QR and manual check-in",
                "Dedicated access for reception staff",
                "Attendance overview as people arrive",
              ],
            },
          ].map(({ number, title, text, points }) => (
            <LandingMotion
              key={number}
              className={styles.stage}
              variant="stage"
            >
              <span className={styles.stageNumber} data-stage-number>
                {number}
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
              <ul>
                {points.map((point) => (
                  <li key={point}>
                    <Check fontSize="small" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </LandingMotion>
          ))}
        </div>
      </section>

      <section
        id="features"
        className={styles.section}
        aria-labelledby="features-title"
      >
        <LandingMotion className={styles.sectionHeading} variant="heading">
          <div>
            <p className={styles.eyebrow}>THOUGHTFUL TOOLS. LESS BUSYWORK.</p>
            <h2 id="features-title">
              The details make
              <br />
              the experience.
            </h2>
          </div>
          <p className={styles.sectionIntro}>
            Build the event you have in mind, then keep the practical work in
            the same place.
          </p>
        </LandingMotion>
        <div className={styles.features}>
          {capabilities.map(({ icon: Icon, title, text, label }) => (
            <LandingMotion
              className={styles.feature}
              key={label}
              variant="feature"
            >
              <div className={styles.featureTop}>
                <Icon data-feature-icon />
                <span className={styles.eyebrow}>{label}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </LandingMotion>
          ))}
        </div>
      </section>

      <section
        id="for-attendees"
        className={styles.attendees}
        aria-labelledby="attendees-title"
      >
        <LandingMotion>
          <p className={styles.eyebrow}>ON THE OTHER SIDE OF THE INVITATION</p>
          <h2 id="attendees-title">
            Something to look
            <br />
            forward to.
          </h2>
          <p className={styles.lead}>
            Discover your next event, apply to attend and get the details you
            need for the day.
          </p>
          <div className={styles.actions}>
            <Button variant="contained" href="/e" endIcon={<ArrowForward />}>
              Find your next event
            </Button>
            <Button href={signedIn ? "/account/registrations" : "/register"}>
              {signedIn ? "My registrations" : "Create an account"}
            </Button>
          </div>
        </LandingMotion>
        <LandingMotion className={styles.attendeeSteps} variant="steps">
          {[
            {
              icon: EventAvailableOutlined,
              title: "Find your people",
              text: "Browse public events, explore the schedule and see what’s planned.",
            },
            {
              icon: EditNoteOutlined,
              title: "Tell the organizer about you",
              text: "Complete the application and receive its status updates by email.",
            },
            {
              icon: ConfirmationNumberOutlined,
              title: "Keep your ticket close",
              text: "Once approved, access your QR ticket and get ready to check in.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className={styles.attendeeStep} data-attendee-step>
              <span className={styles.attendeeIcon}>
                <Icon />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </LandingMotion>
      </section>

      <section
        id="questions"
        className={`${styles.section} ${styles.faq}`}
        aria-labelledby="questions-title"
      >
        <LandingMotion>
          <p className={styles.eyebrow}>GOOD TO KNOW</p>
          <h2 id="questions-title">
            A few details,
            <br />
            before you begin.
          </h2>
          <p className={styles.sectionIntro}>
            A clear picture of how Event Flow works.
          </p>
        </LandingMotion>
        <div>
          {questions.map(({ title, answer }) => (
            <details key={title} className={styles.question}>
              <summary>
                {title}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <LandingMotion variant="closing">
        <section className={styles.closing} aria-labelledby="closing-title">
          <CheckCircleOutlined className={styles.closingIcon} />
          <p className={styles.eyebrow}>MAKE THE NEXT GATHERING HAPPEN</p>
          <h2 id="closing-title">
            Your people.
            <br />
            Your plans. <span>In flow.</span>
          </h2>
          <p>Start with an idea. Turn it into a place to meet.</p>
          <Button
            href={organizerHref}
            size="large"
            variant="contained"
            endIcon={<ArrowForward />}
          >
            {organizerLabel}
          </Button>
          <a href="/e" className={styles.closingLink}>
            Just here to explore? Find an event.
          </a>
        </section>
      </LandingMotion>
    </div>
  );
}
