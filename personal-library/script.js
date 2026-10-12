const reveals = document.querySelectorAll(".reveal");
const videos = [...document.querySelectorAll("video")];
const motionToggle = document.querySelector(".motion-toggle");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if ("IntersectionObserver" in window && !prefersReducedMotion.matches) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  reveals.forEach((element) => revealObserver.observe(element));

  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) entry.target.pause();
        else if (motionToggle?.dataset.paused !== "true") entry.target.play().catch(() => {});
      });
    },
    { rootMargin: "120px 0px", threshold: 0.05 },
  );

  videos.forEach((video) => videoObserver.observe(video));
} else {
  reveals.forEach((element) => element.classList.add("is-visible"));
  videos.forEach((video) => video.pause());
}

motionToggle?.addEventListener("click", () => {
  const shouldPause = motionToggle.dataset.paused !== "true";
  motionToggle.dataset.paused = String(shouldPause);
  motionToggle.textContent = shouldPause ? "Play" : "Pause";
  motionToggle.setAttribute(
    "aria-label",
    shouldPause ? "Play demo animations" : "Pause demo animations",
  );

  videos.forEach((video) => {
    if (shouldPause) video.pause();
    else video.play().catch(() => {});
  });
});
