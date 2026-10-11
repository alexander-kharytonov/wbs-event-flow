"use client";

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
import { useTranslations } from "next-intl";
import styles from "@/features/landing/landing.module.css";
import { LandingMotion } from "@/features/landing/landing-motion";

export function LandingPage({
  organizerHref,
  organizer,
  signedIn,
}: {
  organizerHref: string;
  organizer: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations("landing");

  const capabilities = [
    {
      icon: EditNoteOutlined,
      title: t("pageTitle"),
      text: t("pageText"),
      label: t("pageLabel"),
    },
    {
      icon: TuneOutlined,
      title: t("formTitle"),
      text: t("formText"),
      label: t("formLabel"),
    },
    {
      icon: GroupsOutlined,
      title: t("teamTitle"),
      text: t("teamText"),
      label: t("teamLabel"),
    },
    {
      icon: EmailOutlined,
      title: t("commTitle"),
      text: t("commText"),
      label: t("commLabel"),
    },
    {
      icon: BadgeOutlined,
      title: t("welcomeTitle"),
      text: t("welcomeText"),
      label: t("welcomeLabel"),
    },
    {
      icon: ContentCopyOutlined,
      title: t("repeatTitle"),
      text: t("repeatText"),
      label: t("repeatLabel"),
    },
  ];

  const questions = [
    {
      title: t("reviewQuestion"),
      answer: t("reviewAnswer"),
    },
    {
      title: t("accountQuestion"),
      answer: t("accountAnswer"),
    },
    {
      title: t("privateQuestion"),
      answer: t("privateAnswer"),
    },
    {
      title: t("editQuestion"),
      answer: t("editAnswer"),
    },
    {
      title: t("teamQuestion"),
      answer: t("teamAnswer"),
    },
  ];

  const organizerLabel = organizer ? t("workspace") : t("organize");

  return (
    <div className={styles.landing}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <LandingMotion className={styles.heroCopy} variant="hero">
          <div className={styles.eyebrow}>
            <span className={styles.signal} />
            {t("eyebrow")}
          </div>
          <h1 id="landing-title">
            {t.rich("hero", {
              br: () => <br />,
              desktopBr: () => <br className={styles.desktopBreak} />,
              accent: (chunks) => <span>{chunks}</span>,
            })}
          </h1>
          <p className={styles.lead}>{t("lead")}</p>
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
              {t("explore")}
            </Button>
          </div>
          <a href="#how-it-works" className={styles.sectionLink}>
            {t("connects")}
            <ArrowDownward fontSize="small" />
          </a>
        </LandingMotion>
        <LandingMotion className={styles.flow} variant="flow">
          <div className={styles.flowHeader}>
            <span className={styles.eyebrow}>{t("flow")}</span>
            <span className={styles.flowMarker}>{t("idea")}</span>
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
                title: t("step1"),
                detail: t("step1Detail"),
                status: t("step1Status"),
              },
              {
                icon: FactCheckOutlined,
                number: "02",
                title: t("step2"),
                detail: t("step2Detail"),
                status: t("step2Status"),
              },
              {
                icon: ConfirmationNumberOutlined,
                number: "03",
                title: t("step3"),
                detail: t("step3Detail"),
                status: t("step3Status"),
              },
              {
                icon: QrCodeScannerOutlined,
                number: "04",
                title: t("step4"),
                detail: t("step4Detail"),
                status: t("step4Status"),
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
          <p className={styles.flowFooter}>{t("flowFooter")}</p>
        </LandingMotion>
      </section>

      <nav className={styles.contents} aria-label={t("discoverAria")}>
        <a href="#how-it-works">
          01 <span>{t("how")}</span>
        </a>
        <a href="#features">
          02 <span>{t("toolkit")}</span>
        </a>
        <a href="#for-attendees">
          03 <span>{t("attendees")}</span>
        </a>
        <a href="#questions">
          04 <span>{t("know")}</span>
        </a>
      </nav>

      <section
        id="how-it-works"
        className={styles.section}
        aria-labelledby="workflow-title"
      >
        <LandingMotion className={styles.sectionHeading} variant="heading">
          <div>
            <p className={styles.eyebrow}>{t("planning")}</p>
            <h2 id="workflow-title">
              {t.rich("stagesTitle", {
                br: () => <br />,
                accent: (chunks) => <span>{chunks}</span>,
              })}
            </h2>
          </div>
          <p className={styles.sectionIntro}>{t("stagesIntro")}</p>
        </LandingMotion>
        <div className={styles.stages}>
          {[
            {
              number: "01",
              title: t("prepare"),
              text: t("prepareText"),
              points: [t("prepare1"), t("prepare2"), t("prepare3")],
            },
            {
              number: "02",
              title: t("coming"),
              text: t("comingText"),
              points: [t("coming1"), t("coming2"), t("coming3")],
            },
            {
              number: "03",
              title: t("door"),
              text: t("doorText"),
              points: [t("door1"), t("door2"), t("door3")],
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
            <p className={styles.eyebrow}>{t("tools")}</p>
            <h2 id="features-title">
              {t.rich("toolsTitle", {
                br: () => <br />,
                accent: (chunks) => <span>{chunks}</span>,
              })}
            </h2>
          </div>
          <p className={styles.sectionIntro}>{t("toolsIntro")}</p>
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
          <p className={styles.eyebrow}>{t("invitation")}</p>
          <h2 id="attendees-title">
            {t.rich("attendeeTitle", {
              br: () => <br />,
              desktopBr: () => <br className={styles.desktopBreak} />,
              accent: (chunks) => <span>{chunks}</span>,
            })}
          </h2>
          <p className={styles.lead}>{t("attendeeLead")}</p>
          <div className={styles.actions}>
            <Button variant="contained" href="/e" endIcon={<ArrowForward />}>
              {t("findEvent")}
            </Button>
            <Button href={signedIn ? "/account/registrations" : "/register"}>
              {signedIn ? t("myRegistrations") : t("createAccount")}
            </Button>
          </div>
        </LandingMotion>
        <LandingMotion className={styles.attendeeSteps} variant="steps">
          {[
            {
              icon: EventAvailableOutlined,
              title: t("findPeople"),
              text: t("findPeopleText"),
            },
            {
              icon: EditNoteOutlined,
              title: t("aboutYou"),
              text: t("aboutYouText"),
            },
            {
              icon: ConfirmationNumberOutlined,
              title: t("ticket"),
              text: t("ticketText"),
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
          <p className={styles.eyebrow}>{t("faqEyebrow")}</p>
          <h2 id="questions-title">
            {t.rich("faqTitle", {
              br: () => <br />,
              desktopBr: () => <br className={styles.desktopBreak} />,
              accent: (chunks) => <span>{chunks}</span>,
            })}
          </h2>
          <p className={styles.sectionIntro}>{t("faqIntro")}</p>
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
          <p className={styles.eyebrow}>{t("closingEyebrow")}</p>
          <h2 id="closing-title">
            {t.rich("closingTitle", {
              br: () => <br />,
              desktopBr: () => <br className={styles.desktopBreak} />,
              accent: (chunks) => <span>{chunks}</span>,
            })}
          </h2>
          <p>{t("closingLead")}</p>
          <Button
            href={organizerHref}
            size="large"
            variant="contained"
            endIcon={<ArrowForward />}
          >
            {organizerLabel}
          </Button>
          <a href="/e" className={styles.closingLink}>
            {t("closingExplore")}
          </a>
        </section>
      </LandingMotion>
    </div>
  );
}
