
      function typeText(el, text, speed) {
        return new Promise((resolve) => {
          el.textContent = "";
          const cursor = document.createElement("span");
          cursor.className = "typed-cursor";
          cursor.textContent = "|";
          el.appendChild(cursor);
          let i = 0;
          const step = () => {
            if (i < text.length) {
              cursor.insertAdjacentText("beforebegin", text.charAt(i));
              i++;
              setTimeout(step, speed);
            } else {
              cursor.remove();
              resolve();
            }
          };
          step();
        });
      }

      document.addEventListener("DOMContentLoaded", () => {
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const subtitle = document.querySelector(".hero-subtitle");
        const revealSubtitle = () => {
          if (subtitle) {
            subtitle.style.opacity = "1";
            subtitle.style.transform = "translateY(0)";
          }
        };

        // 1. Hero headline type-on effect (falls back to the static text already in the
        //    HTML if this fails for any reason — see the noscript block in <head> too)
        try {
          const typedTarget = document.getElementById("typed-text");
          if (typedTarget && !prefersReducedMotion) {
            typeText(typedTarget, "Technology made simple.", 55).then(
              revealSubtitle,
            );
          } else {
            revealSubtitle();
          }
        } catch (err) {
          revealSubtitle();
        }

        // 2. Smooth Cursor Dot following mouse (fine-pointer devices, motion allowed)
        try {
          const cursor = document.querySelector(".custom-cursor");
          if (cursor) {
            if (
              window.matchMedia("(pointer: fine)").matches &&
              !prefersReducedMotion
            ) {
              let mouseX = -100;
              let mouseY = -100;
              let cursorX = -100;
              let cursorY = -100;
              let isHovered = false;

              document.addEventListener("mousemove", (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
              });

              const animateCursor = () => {
                // Smooth Lerp for lag-free motion
                cursorX += (mouseX - cursorX) * 0.15;
                cursorY += (mouseY - cursorY) * 0.15;

                const scale = isHovered ? " scale(2.2)" : "";
                cursor.style.transform = `translate3d(${cursorX - 4}px, ${cursorY - 4}px, 0)${scale}`;
                requestAnimationFrame(animateCursor);
              };
              requestAnimationFrame(animateCursor);

              // Hover scale adjustments for interactive targets
              const interactives = document.querySelectorAll(
                "a, button, .cta-button, .project-image-container",
              );
              interactives.forEach((item) => {
                item.addEventListener("mouseenter", () => {
                  isHovered = true;
                  cursor.style.backgroundColor = "transparent";
                  cursor.style.border = "1px solid var(--ets-gold)";
                  cursor.style.transition =
                    "transform 0.2s, background-color 0.2s, border 0.2s";
                });
                item.addEventListener("mouseleave", () => {
                  isHovered = false;
                  cursor.style.backgroundColor = "var(--ets-gold)";
                  cursor.style.border = "none";
                });
              });
            } else {
              // Disable on touch screens or when reduced motion is requested
              cursor.style.display = "none";
            }
          }
        } catch (err) {
          // Decorative enhancement only — safe to skip silently
        }

        // 3. Scroll Parallax effect on large background text layers
        try {
          if (!prefersReducedMotion) {
            window.addEventListener("scroll", () => {
              const scrollY = window.scrollY;

              // Hero Background Parallax
              const heroBg = document.querySelector(".kinetic-hero-bg");
              if (heroBg) {
                heroBg.style.transform = `translate3d(${scrollY * 0.15}px, -50%, 0)`;
              }

              // Section Background Parallax elements
              const kinetics = document.querySelectorAll(
                ".section-header-kinetic .kinetic-bg",
              );
              kinetics.forEach((bg) => {
                const rect = bg.parentElement.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                  const relativeOffset = (window.innerHeight - rect.top) * 0.1;
                  bg.style.transform = `translate3d(${relativeOffset}px, 0, 0)`;
                }
              });

              // Contact Section Background Parallax
              const contactBg = document.querySelector(".kinetic-contact-bg");
              if (contactBg) {
                const rect = contactBg.parentElement.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                  const relativeOffset = (window.innerHeight - rect.top) * 0.12;
                  contactBg.style.transform = `translate3d(${relativeOffset}px, -50%, 0)`;
                }
              }
            });
          }
        } catch (err) {
          // Decorative enhancement only — safe to skip silently
        }

        // 4. Scroll-Triggered Reveal Animations via Intersection Observer
        try {
          const revealElements = document.querySelectorAll(".reveal");
          const revealObserver = new IntersectionObserver(
            (entries, observer) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  entry.target.classList.add("active");
                  observer.unobserve(entry.target);
                }
              });
            },
            { root: null, rootMargin: "0px", threshold: 0.1 },
          );

          revealElements.forEach((el) => revealObserver.observe(el));
        } catch (err) {
          // If IntersectionObserver is unavailable, show everything rather than hide it
          document
            .querySelectorAll(".reveal")
            .forEach((el) => el.classList.add("active"));
        }

        // 5. Mobile menu toggle
        try {
          const menuToggle = document.querySelector(".menu-toggle");
          const mobileMenu = document.querySelector(".mobile-menu");
          if (menuToggle && mobileMenu) {
            const toggleText = menuToggle.querySelector(".menu-toggle-text");
            const closeMenu = () => {
              mobileMenu.classList.remove("active");
              menuToggle.setAttribute("aria-expanded", "false");
              if (toggleText) toggleText.textContent = "Menu";
              document.body.style.overflow = "";
            };
            const openMenu = () => {
              mobileMenu.classList.add("active");
              menuToggle.setAttribute("aria-expanded", "true");
              if (toggleText) toggleText.textContent = "Close";
              document.body.style.overflow = "hidden";
            };
            menuToggle.addEventListener("click", () => {
              mobileMenu.classList.contains("active")
                ? closeMenu()
                : openMenu();
            });
            mobileMenu.querySelectorAll("a").forEach((link) => {
              link.addEventListener("click", closeMenu);
            });
            document.addEventListener("keydown", (e) => {
              if (e.key === "Escape") closeMenu();
            });
          }
        } catch (err) {
          // Non-critical: nav links still function as plain anchors without the toggle
        }
      });
    