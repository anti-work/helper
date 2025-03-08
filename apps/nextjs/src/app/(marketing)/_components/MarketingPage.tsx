"use client";

import {
  ArrowPathIcon,
  ArrowRightIcon,
  BookOpenIcon,
  HandThumbDownIcon,
  PaperAirplaneIcon,
  StarIcon,
  TrashIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { Shuffle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { useHelper } from "@helperai/react";
import { Button } from "@/components/ui/button";
import { useNativePlatform } from "@/components/useNativePlatform";
import { api } from "@/trpc/react";

const GitHubIcon = ({ className }: { className?: string }) => {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
};

const HeaderButton = ({ children, iconOnly }: { children: React.ReactNode; iconOnly?: boolean }) => {
  return (
    <Button variant="default" className="bg-white bg-opacity-10 text-white" iconOnly={iconOnly}>
      {children}
    </Button>
  );
};

const LoginButtons = ({ githubStars }: { githubStars: number }) => {
  return (
    <div className="flex space-x-2">
      <Link href="https://docs.helper.ai" target="_blank">
        <Button variant="subtle">
          <span className="flex items-center">
            <BookOpenIcon className="h-5 w-5 mr-2" />
            Docs
          </span>
        </Button>
      </Link>
      <Link href="https://github.com/anti-work/helper" target="_blank">
        <Button variant="subtle">
          <span className="flex items-center">
            <GitHubIcon className="h-5 w-5 mr-2" />
            {githubStars.toLocaleString()}
          </span>
        </Button>
      </Link>
    </div>
  );
};

const CardContent = React.memo(({ type }: { type: string }) => {
  switch (type) {
    case "styleLinter":
      return (
        <div className="p-6">
          <div className="max-w-xl flex-grow">
            <div className="my-4 flex flex-col gap-4">
              <div className="flex gap-4 items-end">
                <div className="pb-1">
                  <div className="pb-1">
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0 bg-cover bg-center border-2 border-border"
                      style={{ backgroundImage: "url('/robot-avatar.png')" }}
                    ></div>
                  </div>
                </div>
                <div className="flex-grow">
                  <label htmlFor="customerMessage" className="block text-sm mb-0">
                    Before
                  </label>
                  <textarea
                    id="customerMessage"
                    name="customerMessage"
                    rows={3}
                    className="w-full rounded-lg border-border text-sm focus:border-transparent focus:outline-none focus:ring-muted-foreground dark:text-primary-foreground"
                    placeholder="Enter customer message here"
                    defaultValue={`Hi! That's a great question. When you un-publish your product, it simply removes the product from the public view.`}
                  ></textarea>
                </div>
              </div>
              <div className="flex gap-4 items-end">
                <div className="pb-1">
                  <div
                    className="w-10 h-10 rounded-full flex-shrink-0 bg-cover bg-center border-2 border-primary"
                    style={{ backgroundImage: "url('/human-avatar.png')" }}
                  ></div>
                </div>
                <div className="flex-grow">
                  <label htmlFor="helperResponse" className="block text-sm mb-0">
                    After
                  </label>
                  <textarea
                    id="helperResponse"
                    name="helperResponse"
                    rows={3}
                    className="w-full rounded-lg border-border text-sm focus:border-transparent focus:outline-none focus:ring-muted-foreground dark:text-primary-foreground"
                    placeholder="Enter Helper response here"
                    defaultValue={`Hello, That's a great question. yes, your customers will still be able to read and open the ebook from their email even if you un publish it. Let me know how else I can assist today.`}
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    case "autoDraft":
      return (
        <div className="p-6">
          <div className="max-w-xl flex-grow">
            <div className="mb-4 pr-10">
              <div className="inline-block rounded-lg p-4 bg-muted">
                <div className="lg:text-base text-sm prose">
                  <p>Can i please get a refund on my last purchase?</p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <textarea
                className="w-full rounded-lg border-border text-sm focus:border-transparent focus:outline-none focus:ring-muted-foreground dark:text-primary-foreground"
                rows={5}
                placeholder="Auto-generated response will appear here"
                defaultValue={`Thank you for your refund request. To process this, we'll need your order number and a reason for the refund.

Please reply with this information. We'll review your request within 1-2 business days and get back to you promptly.`}
              ></textarea>
            </div>
            <div className="flex justify-between">
              <button className="hidden md:inline-flex items-center justify-center text-primary bg-background border border-primary hover:bg-primary hover:text-primary-foreground h-10 rounded-md px-4 text-sm transition-colors duration-300">
                <HandThumbDownIcon className="mr-2 h-4 w-4" />
                Bad reply
              </button>
              <div className="flex space-x-2">
                <button className="inline-flex items-center justify-center text-primary bg-background border border-primary hover:bg-primary hover:text-primary-foreground h-10 rounded-md px-4 text-sm transition-colors duration-300">
                  <ArrowPathIcon className="mr-2 h-4 w-4" />
                  Generate draft
                </button>
                <button className="inline-flex items-center justify-center text-primary-foreground bg-primary hover:bg-primary h-10 rounded-md px-4 text-sm">
                  <PaperAirplaneIcon className="mr-2 h-4 w-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    case "pinnedReplies":
      return (
        <div className="p-6">
          <div className="max-w-xl flex-grow">
            <div className="mb-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <UserIcon className="h-3 w-3" />
                <span>Customer</span>
              </div>
              <div className="inline-block rounded-lg p-4 bg-muted mr-10">
                <div className="lg:text-base text-sm prose">
                  <p>Is there a way to offer a customer a partial refund?</p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-end mb-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserIcon className="h-3 w-3" />
                  <span>You</span>
                </div>
              </div>
              <div className="bg-secondary rounded-lg p-4 ml-10">
                <p className="lg:text-base text-sm prose">
                  To issue a partial refund: Open the order, click "Refund," enter the amount, select a reason, and hit
                  "Process." The customer will be notified automatically.
                </p>
              </div>
              <div className="flex justify-end mt-2">
                <button className="inline-flex items-center justify-center text-primary bg-background border border-primary hover:bg-primary hover:text-primary-foreground h-10 rounded-md px-4 text-sm transition-colors duration-300">
                  <StarIcon className="mr-2 h-4 w-4" />
                  Add to FAQs
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    case "promptConfig":
      return (
        <div className="p-6">
          <div className="max-w-xl flex-grow">
            <div>
              <div className="mb-2 flex flex-col gap-2">
                {[
                  "Always thank the customer for their patronage",
                  "Keep replies friendly and concise",
                  "Keep replies under 3 paragraphs at all times",
                ].map((prompt, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="transition-height h-10 w-full truncate rounded-lg border border-border px-3 py-2 text-sm outline-none duration-300 focus:border-border focus:outline-none">
                      {prompt}
                    </div>
                    <button className="inline-flex items-center justify-center font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-primary hover:bg-secondary h-10 rounded text-xs w-10 px-0">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button className="inline-flex items-center justify-center font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-primary hover:bg-secondary h-10 rounded-md px-4 text-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
                data-slot="icon"
                className="mr-2 h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
              Add prompt line
            </button>
          </div>
        </div>
      );
    case "supportTicket1":
      return (
        <div className="p-6">
          <div className="max-w-xl flex-grow">
            <div className="mb-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <UserIcon className="h-3 w-3" />
                <span>Customer</span>
              </div>
              <div className="inline-block rounded-lg p-4 bg-muted mr-10">
                <div className="lg:text-base text-sm prose">
                  <p>How do I download my purchase? I can't find the download link anywhere.</p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-end mb-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserIcon className="h-3 w-3" />
                  <span>Helper AI</span>
                </div>
              </div>
              <div className="bg-secondary rounded-lg p-4 ml-10">
                <p className="lg:text-base text-sm prose">
                  You can download your purchase by logging into your account, going to your library, and clicking the
                  download button next to the product. If you're still having trouble, please let me know and I can
                  provide more specific instructions.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    case "supportTicket2":
      return (
        <div className="p-6">
          <div className="max-w-xl flex-grow">
            <div className="mb-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <UserIcon className="h-3 w-3" />
                <span>Customer</span>
              </div>
              <div className="inline-block rounded-lg p-4 bg-muted mr-10">
                <div className="lg:text-base text-sm prose">
                  <p>I need to update my payment method but I can't figure out how to do it. Can you help?</p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-end mb-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserIcon className="h-3 w-3" />
                  <span>Helper AI</span>
                </div>
              </div>
              <div className="bg-secondary rounded-lg p-4 ml-10">
                <p className="lg:text-base text-sm prose">
                  To update your payment method, go to your account settings, select "Payment methods" from the menu,
                  and click "Add new payment method" or edit an existing one. Let me know if you need any further
                  assistance!
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    case "supportTicket3":
      return (
        <div className="p-6">
          <div className="max-w-xl flex-grow">
            <div className="mb-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <UserIcon className="h-3 w-3" />
                <span>Customer</span>
              </div>
              <div className="inline-block rounded-lg p-4 bg-muted mr-10">
                <div className="lg:text-base text-sm prose">
                  <p>When will my order ship? It's been 3 days and I haven't received any updates.</p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-end mb-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserIcon className="h-3 w-3" />
                  <span>Helper AI</span>
                </div>
              </div>
              <div className="bg-secondary rounded-lg p-4 ml-10">
                <p className="lg:text-base text-sm prose">
                  Orders typically ship within 1-2 business days and delivery takes 3-5 business days depending on your
                  location. I've checked your order status and it was shipped yesterday. You should receive a tracking
                  number via email shortly. Please check your spam folder if you don't see it.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
});

export const MarketingPage = ({ githubStars }: { githubStars: number }) => {
  const { sendPrompt } = useHelper();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [footerBgColor, setFooterBgColor] = useState("#000000");
  const [footerTextColor, setFooterTextColor] = useState("#FFFFFF");
  const isDesktop = useMediaQuery({ minWidth: 1024 });

  useEffect(() => {
    const updateCardWidth = () => {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const minCardWidth = 300;
      const maxCardWidth = 600;
      const calculatedWidth = Math.min(Math.max(vw * (isDesktop ? 0.8 : 0.9), minCardWidth), maxCardWidth);
      setCardWidth(calculatedWidth);
    };

    updateCardWidth();
    window.addEventListener("resize", updateCardWidth);
    return () => window.removeEventListener("resize", updateCardWidth);
  }, [isDesktop]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const scrollContent = scrollContentRef.current;
    if (scrollContainer && scrollContent && cardWidth > 0 && isDesktop) {
      let animationFrameId: number;

      const scroll = () => {
        if (!isHovered) {
          setScrollPosition((prev) => {
            const newPosition = (prev + 0.5) % (cardWidth * 8);
            scrollContainer.scrollLeft = newPosition;
            return newPosition;
          });
        }
        animationFrameId = requestAnimationFrame(scroll);
      };

      animationFrameId = requestAnimationFrame(scroll);

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }
  }, [isHovered, cardWidth, isDesktop]);

  useEffect(() => {
    document.documentElement.style.overflowX = "hidden";
    return () => {
      document.documentElement.style.overflowX = "";
    };
  }, []);

  const cardTypes = useMemo(() => {
    return [
      "styleLinter",
      "autoDraft",
      "pinnedReplies",
      "promptConfig",
      "supportTicket1",
      "supportTicket2",
      "supportTicket3",
    ];
  }, []);

  const generateRandomColors = useCallback(() => {
    const generateRandomColor = () =>
      `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;

    const getContrastRatio = (color1: string, color2: string) => {
      const luminance = (color: string) => {
        const rgb = parseInt(color.slice(1), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const l1 = luminance(color1);
      const l2 = luminance(color2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    let bgColor, textColor;
    do {
      bgColor = generateRandomColor();
      textColor = generateRandomColor();
    } while (getContrastRatio(bgColor, textColor) < 4.5);

    setFooterBgColor(bgColor);
    setFooterTextColor(textColor);
  }, []);

  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    setVH();
    window.addEventListener("resize", setVH);

    return () => window.removeEventListener("resize", setVH);
  }, []);

  const { nativePlatform } = useNativePlatform();
  const router = useRouter();

  if (nativePlatform) {
    router.push("/login");
    return null;
  }

  return (
    <div style={{ backgroundColor: "#3D0C11" }}>
      <header className="sticky top-0 z-50">
        <nav className="flex flex-col md:flex-row items-center md:justify-between p-4 mx-4 space-y-4 md:space-y-0">
          <div className="relative w-[100px] h-[32px] mx-auto md:mx-0">
            <Image
              src="/logo.svg"
              priority
              alt="Helper"
              width={100}
              height={32}
              className={`absolute top-0 left-0 transition-opacity duration-300 ease-in-out opacity-100`}
            />
            <Image
              src="/logo-white.svg"
              priority
              alt="Helper"
              width={100}
              height={32}
              className={`absolute top-0 left-0 transition-opacity duration-300 ease-in-out opacity-100`}
            />
          </div>
          <div className="flex space-x-2 mx-auto md:mx-0">
            <LoginButtons githubStars={githubStars} />
          </div>
        </nav>
      </header>

      <main>
        <section className="py-6 md:p-8">
          <div className="w-full mx-auto bg-bright bg-[url('/hand-bg.svg')] bg-no-repeat bg-left-bottom bg-[length:600px] md:bg-contain md:rounded-3xl p-12">
            <h1 className="font-sundry-narrow-bold text-6xl md:text-8xl font-bold mb-6 text-center text-primary dark:text-primary-foreground">
              World-class support
              <br /> can be <span className="italic">effortless.</span>
            </h1>

            {/* Masonry grid of support tickets and feature cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
              {[0, 1, 2, 3, 4, 5, 6].map((index) => {
                const cardType = cardTypes[index % cardTypes.length] || "styleLinter";
                const isEven = index % 2 === 0;

                return (
                  <div
                    key={index}
                    className={`bg-background rounded-3xl shadow-lg overflow-hidden ${
                      isEven ? "md:col-span-1" : "md:col-span-1 lg:col-span-2"
                    } ${index === 0 ? "md:row-span-2" : ""}`}
                    style={{
                      height: index === 0 ? "auto" : isEven ? "400px" : "350px",
                    }}
                  >
                    <div className="h-full overflow-y-auto">
                      <CardContent type={cardType} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mb-6">
              <Button
                variant="default"
                size="lg"
                className="dark:bg-primary-foreground dark:text-primary relative overflow-hidden group"
                onClick={() => sendPrompt("Hello! What's Helper?")}
              >
                <span className="relative z-10">See it in action</span>
                <div className="absolute inset-0 w-[200%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%]" />
              </Button>
            </div>
          </div>
        </section>

        <section className="p-6">
          <div className="flex items-center justify-center">
            <p className="text-xl md:text-2xl text-white flex flex-col md:flex-row items-center gap-2">
              Powering support for millions on
              <Image
                src="/gumroad-logo-text.svg"
                alt="Gumroad"
                width={120}
                height={35}
                className="relative md:top-[1px] brightness-0 invert mt-2 md:mt-0"
              />
            </p>
          </div>
        </section>

        <section className="py-6">
          <div className="w-[85vw] mx-auto p-6 text-center">
            <h2 className="font-sundry-narrow-bold text-4xl md:text-6xl 2xl:text-8xl font-bold text-secondary dark:text-primary">
              Better-than-human responses
            </h2>
          </div>
          <div
            ref={scrollContainerRef}
            className={`w-full ${isDesktop ? "overflow-x-hidden" : "overflow-x-auto"} overflow-y-hidden scrollbar-hide`}
            onMouseEnter={() => isDesktop && setIsHovered(true)}
            onMouseLeave={() => isDesktop && setIsHovered(false)}
          >
            <div
              ref={scrollContentRef}
              className="flex"
              style={{
                width: `${cardWidth * 16}px`,
                transform: isDesktop ? "none" : `translateX(-${scrollPosition}px)`,
                transition: isDesktop ? "none" : "transform 0.5s ease-out",
              }}
            >
              {[...Array(21)].map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 bg-background rounded-3xl shadow-lg flex flex-col overflow-hidden"
                  style={{
                    width: `${cardWidth - (isDesktop ? 32 : 16)}px`,
                    maxWidth: "568px",
                    minWidth: "350px",
                    height: "700px",
                    margin: isDesktop ? "1rem" : "0.5rem",
                  }}
                >
                  <div className="flex-1 overflow-y-auto">
                    <CardContent type={cardTypes[i % 4] || ""} />
                  </div>

                  <div className="flex-1 bg-secondary p-8 overflow-y-auto">
                    <h3 className="font-sundry-narrow-bold text-3xl md:text-5xl text-primary font-bold mb-4">
                      {i % 7 === 0 && (
                        <>
                          Craft authentic replies in your brand&apos;s voice with
                          <span className="underline-offset">&nbsp;style linter</span>
                        </>
                      )}
                      {i % 7 === 1 && (
                        <>
                          Goodbye writer&apos;s block, hello
                          <span className="underline-offset">&nbsp;auto-generated drafts</span>
                        </>
                      )}
                      {i % 7 === 2 && (
                        <>
                          Your best replies become the new standard with
                          <span className="underline-offset">&nbsp;FAQs</span>
                        </>
                      )}
                      {i % 7 === 3 && (
                        <>
                          Set the rules and Helper will follow your lead with
                          <span className="underline-offset">&nbsp;prompt configuration</span>
                        </>
                      )}
                      {i % 7 === 4 && (
                        <>
                          Quick and accurate responses to
                          <span className="underline-offset">&nbsp;common questions</span>
                        </>
                      )}
                      {i % 7 === 5 && (
                        <>
                          Personalized support for
                          <span className="underline-offset">&nbsp;account management</span>
                        </>
                      )}
                      {i % 7 === 6 && (
                        <>
                          Proactive updates on
                          <span className="underline-offset">&nbsp;order status</span>
                        </>
                      )}
                    </h3>
                    <p className="text-md text-muted-foreground">
                      {i % 7 === 0 && "Human touch, robot efficiency"}
                      {i % 7 === 1 && "All you have to do is click send."}
                      {i % 7 === 2 && "Pin your best and watch Helper learn"}
                      {i % 7 === 3 && "Responses that fit your needs."}
                      {i % 7 === 4 && "Save time with instant answers"}
                      {i % 7 === 5 && "Help customers manage their accounts"}
                      {i % 7 === 6 && "Keep customers informed about their orders"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-6 md:p-8">
          <div className="w-full mx-auto bg-background rounded-3xl p-6 md:p-12 text-center">
            <h2 className="font-sundry-narrow-bold text-4xl md:text-6xl 2xl:text-8xl font-bold text-primary mb-6">
              Simple, transparent, usage-based pricing
            </h2>
            <div className="text-2xl md:text-3xl text-primary mb-8">
              <span className="font-bold">$0.99</span> per resolution
            </div>

            <div className="max-w-2xl mx-auto grid md:grid-cols-2 gap-8 text-left mb-12">
              <div>
                <h3 className="font-sundry-narrow-bold text-xl mb-4 text-primary">Core features</h3>
                <ul className="space-y-3">
                  {[
                    "Shared inbox",
                    "In-app live chat",
                    "Human handoff",
                    "Magical auto-assign",
                    "Intelligent workflows",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center text-muted-foreground">
                      <svg
                        className="w-5 h-5 mr-2 text-[#C2D44B]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-sundry-narrow-bold text-xl mb-4 text-primary">Unlimited features</h3>
                <ul className="space-y-3">
                  {["AI drafts", "Multiple team inboxes", "Help docs ingestion", "Knowledge bank", "Tool usage"].map(
                    (feature) => (
                      <li key={feature} className="flex items-center text-muted-foreground">
                        <svg
                          className="w-5 h-5 mr-2 text-[#C2D44B]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[#C2D44B] text-[#3D0C11] font-medium">
                          Unlimited
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-end" style={{ backgroundColor: "#3D0C11" }}>
          <div className="md:px-8">
            <div className="mx-auto bg-[#C2D44B] rounded-t-3xl p-6 md:p-12 flex flex-col items-center justify-center text-center">
              <h1 className="font-sundry-narrow-bold text-6xl md:text-8xl md:mb-12 md:px-12 font-bold mb-12 text-[#3D0C11]">
                Ready to stop answering <br /> every-single-one <br /> of your support tickets?
              </h1>
              <Link href="/login">
                <Button
                  variant="default"
                  className="font-sundry-narrow-bold text-xl px-8 py-8 bg-[#3D0C11] text-primary-foreground hover:bg-[#2D090D] transition-colors duration-300"
                >
                  Start using Helper
                  <ArrowRightIcon className="h-5 w-5 ml-2 jiggle-animation" />
                </Button>
              </Link>
            </div>
          </div>
          <div
            className="w-full h-[10vh] px-12 transition-colors duration-300 flex items-center"
            style={{ backgroundColor: footerBgColor }}
          >
            <div className=" flex justify-between items-center w-full">
              <div className="flex items-center">
                <div className="flex flex-col items-start">
                  <a href="https://antiwork.com/" target="_blank" rel="noopener noreferrer">
                    <svg
                      width="200"
                      height="40"
                      viewBox="0 0 500 100"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className=""
                    >
                      <path
                        d="M99.94 73.44H111.04L105.64 57.72H105.52L99.94 73.44ZM100.84 47.16H110.5L126.52 90H116.74L113.5 80.46H97.48L94.12 90H84.64L100.84 47.16ZM129.314 58.98H137.414V63.3H137.594C138.674 61.5 140.074 60.2 141.794 59.4C143.514 58.56 145.274 58.14 147.074 58.14C149.354 58.14 151.214 58.46 152.654 59.1C154.134 59.7 155.294 60.56 156.134 61.68C156.974 62.76 157.554 64.1 157.874 65.7C158.234 67.26 158.414 69 158.414 70.92V90H149.894V72.48C149.894 69.92 149.494 68.02 148.694 66.78C147.894 65.5 146.474 64.86 144.434 64.86C142.114 64.86 140.434 65.56 139.394 66.96C138.354 68.32 137.834 70.58 137.834 73.74V90H129.314V58.98ZM175.681 58.98H181.921V64.68H175.681V80.04C175.681 81.48 175.921 82.44 176.401 82.92C176.881 83.4 177.841 83.64 179.281 83.64C179.761 83.64 180.221 83.62 180.661 83.58C181.101 83.54 181.521 83.48 181.921 83.4V90C181.201 90.12 180.401 90.2 179.521 90.24C178.641 90.28 177.781 90.3 176.941 90.3C175.621 90.3 174.361 90.2 173.161 90C172.001 89.84 170.961 89.5 170.041 88.98C169.161 88.46 168.461 87.72 167.941 86.76C167.421 85.8 167.161 84.54 167.161 82.98V64.68H162.001V58.98H167.161V49.68H175.681V58.98ZM194.734 54.18H186.214V47.16H194.734V54.18ZM186.214 58.98H194.734V90H186.214V58.98ZM236.903 90H228.143L222.623 69.18H222.503L217.223 90H208.403L198.563 58.98H207.563L213.263 80.04H213.383L218.543 58.98H226.823L232.103 79.98H232.223L237.923 58.98H246.683L236.903 90ZM257.87 74.52C257.87 75.76 257.99 76.98 258.23 78.18C258.47 79.34 258.87 80.4 259.43 81.36C260.03 82.28 260.81 83.02 261.77 83.58C262.73 84.14 263.93 84.42 265.37 84.42C266.81 84.42 268.01 84.14 268.97 83.58C269.97 83.02 270.75 82.28 271.31 81.36C271.91 80.4 272.33 79.34 272.57 78.18C272.81 76.98 272.93 75.76 272.93 74.52C272.93 73.28 272.81 72.06 272.57 70.86C272.33 69.66 271.91 68.6 271.31 67.68C270.75 66.76 269.97 66.02 268.97 65.46C268.01 64.86 266.81 64.56 265.37 64.56C263.93 64.56 262.73 64.86 261.77 65.46C260.81 66.02 260.03 66.76 259.43 67.68C258.87 68.6 258.47 69.66 258.23 70.86C257.99 72.06 257.87 73.28 257.87 74.52ZM249.35 74.52C249.35 72.04 249.73 69.8 250.49 67.8C251.25 65.76 252.33 64.04 253.73 62.64C255.13 61.2 256.81 60.1 258.77 59.34C260.73 58.54 262.93 58.14 265.37 58.14C267.81 58.14 270.01 58.54 271.97 59.34C273.97 60.1 275.67 61.2 277.07 62.64C278.47 64.04 279.55 65.76 280.31 67.8C281.07 69.8 281.45 72.04 281.45 74.52C281.45 77 281.07 79.24 280.31 81.24C279.55 83.24 278.47 84.96 277.07 86.4C275.67 87.8 273.97 88.88 271.97 89.64C270.01 90.4 267.81 90.78 265.37 90.78C262.93 90.78 260.73 90.4 258.77 89.64C256.81 88.88 255.13 87.8 253.73 86.4C252.33 84.96 251.25 83.24 250.49 81.24C249.73 79.24 249.35 77 249.35 74.52ZM286.99 58.98H295.09V64.74H295.21C295.61 63.78 296.15 62.9 296.83 62.1C297.51 61.26 298.29 60.56 299.17 60C300.05 59.4 300.99 58.94 301.99 58.62C302.99 58.3 304.03 58.14 305.11 58.14C305.67 58.14 306.29 58.24 306.97 58.44V66.36C306.57 66.28 306.09 66.22 305.53 66.18C304.97 66.1 304.43 66.06 303.91 66.06C302.35 66.06 301.03 66.32 299.95 66.84C298.87 67.36 297.99 68.08 297.31 69C296.67 69.88 296.21 70.92 295.93 72.12C295.65 73.32 295.51 74.62 295.51 76.02V90H286.99V58.98ZM311.09 47.16H319.61V70.14L330.35 58.98H340.43L328.73 70.38L341.75 90H331.43L322.91 76.14L319.61 79.32V90H311.09V47.16Z"
                        fill={footerTextColor}
                      />
                      <path
                        d="M8.608 8.864H10.648V15.272H10.696C11.032 14.584 11.56 14.088 12.28 13.784C13 13.464 13.792 13.304 14.656 13.304C15.616 13.304 16.448 13.48 17.152 13.832C17.872 14.184 18.464 14.664 18.928 15.272C19.408 15.864 19.768 16.552 20.008 17.336C20.248 18.12 20.368 18.952 20.368 19.832C20.368 20.712 20.248 21.544 20.008 22.328C19.784 23.112 19.432 23.8 18.952 24.392C18.488 24.968 17.896 25.424 17.176 25.76C16.472 26.096 15.648 26.264 14.704 26.264C14.4 26.264 14.056 26.232 13.672 26.168C13.304 26.104 12.936 26 12.568 25.856C12.2 25.712 11.848 25.52 11.512 25.28C11.192 25.024 10.92 24.712 10.696 24.344H10.648V26H8.608V8.864ZM18.208 19.688C18.208 19.112 18.128 18.552 17.968 18.008C17.824 17.448 17.592 16.952 17.272 16.52C16.968 16.088 16.568 15.744 16.072 15.488C15.592 15.232 15.024 15.104 14.368 15.104C13.68 15.104 13.096 15.24 12.616 15.512C12.136 15.784 11.744 16.144 11.44 16.592C11.136 17.024 10.912 17.52 10.768 18.08C10.64 18.64 10.576 19.208 10.576 19.784C10.576 20.392 10.648 20.984 10.792 21.56C10.936 22.12 11.16 22.616 11.464 23.048C11.784 23.48 12.192 23.832 12.688 24.104C13.184 24.36 13.784 24.488 14.488 24.488C15.192 24.488 15.776 24.352 16.24 24.08C16.72 23.808 17.104 23.448 17.392 23C17.68 22.552 17.888 22.04 18.016 21.464C18.144 20.888 18.208 20.296 18.208 19.688ZM33.0346 26H31.1146V24.032H31.0666C30.6346 24.8 30.0826 25.368 29.4106 25.736C28.7386 26.088 27.9466 26.264 27.0346 26.264C26.2186 26.264 25.5386 26.16 24.9946 25.952C24.4506 25.728 24.0106 25.416 23.6746 25.016C23.3386 24.616 23.0986 24.144 22.9546 23.6C22.8266 23.04 22.7626 22.424 22.7626 21.752V13.592H24.8026V21.992C24.8026 22.76 25.0266 23.368 25.4746 23.816C25.9226 24.264 26.5386 24.488 27.3226 24.488C27.9466 24.488 28.4826 24.392 28.9306 24.2C29.3946 24.008 29.7786 23.736 30.0826 23.384C30.3866 23.032 30.6106 22.624 30.7546 22.16C30.9146 21.68 30.9946 21.16 30.9946 20.6V13.592H33.0346V26ZM38.2585 11.36H36.2185V8.864H38.2585V11.36ZM36.2185 13.592H38.2585V26H36.2185V13.592ZM41.5388 8.864H43.5788V26H41.5388V8.864ZM49.5711 13.592H52.0431V15.392H49.5711V23.096C49.5711 23.336 49.5871 23.528 49.6191 23.672C49.6671 23.816 49.7471 23.928 49.8591 24.008C49.9711 24.088 50.1231 24.144 50.3151 24.176C50.5231 24.192 50.7871 24.2 51.1071 24.2H52.0431V26H50.4831C49.9551 26 49.4991 25.968 49.1151 25.904C48.7471 25.824 48.4431 25.688 48.2031 25.496C47.9791 25.304 47.8111 25.032 47.6991 24.68C47.5871 24.328 47.5311 23.864 47.5311 23.288V15.392H45.4191V13.592H47.5311V9.872H49.5711V13.592ZM61.0611 8.864H63.1011V15.272H63.1491C63.4851 14.584 64.0131 14.088 64.7331 13.784C65.4531 13.464 66.2451 13.304 67.1091 13.304C68.0691 13.304 68.9011 13.48 69.6051 13.832C70.3251 14.184 70.9171 14.664 71.3811 15.272C71.8611 15.864 72.2211 16.552 72.4611 17.336C72.7011 18.12 72.8211 18.952 72.8211 19.832C72.8211 20.712 72.7011 21.544 72.4611 22.328C72.2371 23.112 71.8851 23.8 71.4051 24.392C70.9411 24.968 70.3491 25.424 69.6291 25.76C68.9251 26.096 68.1011 26.264 67.1571 26.264C66.8531 26.264 66.5091 26.232 66.1251 26.168C65.7571 26.104 65.3891 26 65.0211 25.856C64.6531 25.712 64.3011 25.52 63.9651 25.28C63.6451 25.024 63.3731 24.712 63.1491 24.344H63.1011V26H61.0611V8.864ZM70.6611 19.688C70.6611 19.112 70.5811 18.552 70.4211 18.008C70.2771 17.448 70.0451 16.952 69.7251 16.52C69.4211 16.088 69.0211 15.744 68.5251 15.488C68.0451 15.232 67.4771 15.104 66.8211 15.104C66.1331 15.104 65.5491 15.24 65.0691 15.512C64.5891 15.784 64.1971 16.144 63.8931 16.592C63.5891 17.024 63.3651 17.52 63.2211 18.08C63.0931 18.64 63.0291 19.208 63.0291 19.784C63.0291 20.392 63.1011 20.984 63.2451 21.56C63.3891 22.12 63.6131 22.616 63.9171 23.048C64.2371 23.48 64.6451 23.832 65.1411 24.104C65.6371 24.36 66.2371 24.488 66.9411 24.488C67.6451 24.488 68.2291 24.352 68.6931 24.08C69.1731 23.808 69.5571 23.448 69.8451 23C70.1331 22.552 70.3411 22.04 70.4691 21.464C70.5971 20.888 70.6611 20.296 70.6611 19.688ZM80.0877 27.656C79.8477 28.264 79.6077 28.776 79.3677 29.192C79.1437 29.608 78.8877 29.944 78.5997 30.2C78.3277 30.472 78.0157 30.664 77.6637 30.776C77.3277 30.904 76.9357 30.968 76.4877 30.968C76.2477 30.968 76.0077 30.952 75.7677 30.92C75.5277 30.888 75.2957 30.832 75.0717 30.752V28.88C75.2477 28.96 75.4477 29.024 75.6717 29.072C75.9117 29.136 76.1117 29.168 76.2717 29.168C76.6877 29.168 77.0317 29.064 77.3037 28.856C77.5917 28.664 77.8077 28.384 77.9517 28.016L78.7917 25.928L73.8717 13.592H76.1757L79.7997 23.744H79.8477L83.3277 13.592H85.4877L80.0877 27.656Z"
                        fill={footerTextColor}
                      />
                      <path d="M57 91L41.4115 47.5L72.5885 47.5L57 91Z" fill={footerTextColor} />
                      <path d="M25 91L9.41154 47.5L40.5885 47.5L25 91Z" fill={footerTextColor} />
                    </svg>
                  </a>
                </div>
              </div>
              <div className="flex items-center">
                <Button
                  onClick={generateRandomColors}
                  className="transition-colors duration-300"
                  iconOnly
                  style={{ backgroundColor: footerTextColor, color: footerBgColor }}
                >
                  <Shuffle className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @keyframes jiggle {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(3px);
          }
          75% {
            transform: translateX(-3px);
          }
        }
        .jiggle-animation {
          animation: jiggle 1s ease-in-out infinite;
        }

        .underline-offset {
          background: linear-gradient(var(--underline-color, #fbbf24), var(--underline-color, #fbbf24)) 0
            var(--y-pos, 100%) / 100% var(--size, 14px) no-repeat;
        }

        @media (prefers-color-scheme: dark) {
          .underline-offset {
            --underline-color: #280c0c;
          }
        }

        html,
        body {
          height: -webkit-fill-available;
        }

        #__next {
          height: 100%;
        }

        /* Hide scrollbar for Chrome, Safari and Opera */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .scrollbar-hide {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
      `}</style>
    </div>
  );
};
