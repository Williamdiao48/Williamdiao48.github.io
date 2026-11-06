// Plays each demo clip only while it's on screen, so the page loads and runs light.
// With reduced motion on, clips stay still and get controls instead.
(() => {
  const videos = [...document.querySelectorAll('.feature video')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    videos.forEach(video => { video.controls = true; });
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) target.play().catch(() => { target.controls = true; });
      else target.pause();
    });
  }, { threshold: .5 });
  videos.forEach(video => observer.observe(video));
})();
