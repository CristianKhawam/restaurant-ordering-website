// Image carousel on the home page. It changes slide every 4 seconds
// unless it is paused, and the arrows and dots change it by hand.

const AUTOPLAY_DELAY_MS = 4000;

const SLIDES = [
  { file: "images/carousel/slide-01.webp", alt: "Signature Classic Burger on a wooden board", caption: "Our Classic Burger" },
  { file: "images/carousel/slide-02.webp", alt: "Chef smashing burger patties on a hot griddle", caption: "Smashed to order" },
  { file: "images/carousel/slide-03.webp", alt: "Red and yellow dining room decorated with anime posters", caption: "Our dining room" },
  { file: "images/carousel/slide-04.webp", alt: "Golden fries in a red paper cone", caption: "Crispy Fries" },
  { file: "images/carousel/slide-05.webp", alt: "Chocolate milkshake topped with whipped cream", caption: "Chocolate Milkshake" },
  { file: "images/carousel/slide-06.webp", alt: "Spicy burger with jalapeños and melted cheese", caption: "Spicy Jalapeño Burger" },
  { file: "images/carousel/slide-07.webp", alt: "Friends sharing burgers at a neon-lit counter", caption: "Burgers with friends" },
  { file: "images/carousel/slide-08.webp", alt: "Crispy chicken nuggets with dipping sauces", caption: "Chicken Nuggets" },
  { file: "images/carousel/slide-09.webp", alt: "Restaurant storefront at night with a glowing sign", caption: "See you tonight!" },
  { file: "images/carousel/slide-10.webp", alt: "Ice-cream sundae with strawberry sauce", caption: "Strawberry Sundae" },
];

const carouselElement = document.getElementById("carousel");
const trackElement = document.getElementById("carousel-track");
const dotsElement = document.getElementById("carousel-dots");
const toggleButton = document.getElementById("carousel-toggle");
const statusElement = document.getElementById("carousel-status");

let currentSlideIndex = 0;
let isPaused = false;
let autoplayTimerId = null;

function buildSlides() {
  SLIDES.forEach((slide, index) => {
    const figure = document.createElement("figure");
    figure.className = "carousel-slide";
    figure.setAttribute("role", "group");
    figure.setAttribute("aria-roledescription", "slide");
    figure.setAttribute("aria-label", `${index + 1} of ${SLIDES.length}`);

    const image = document.createElement("img");
    image.alt = slide.alt;
    image.src = slide.file;

    const caption = document.createElement("figcaption");
    caption.textContent = slide.caption;

    figure.append(image, caption);
    trackElement.append(figure);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel-dot";
    dot.setAttribute("aria-label", `Show photo ${index + 1}: ${slide.caption}`);
    dot.addEventListener("click", () => {
      goToSlide(index);
      restartAutoplay();
    });
    dotsElement.append(dot);
  });
}

function goToSlide(newIndex) {
  // Wrap around: after the last slide comes the first, and vice versa
  currentSlideIndex = (newIndex + SLIDES.length) % SLIDES.length;

  // Every slide is 100% wide, so slide N starts at -N * 100%
  trackElement.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

  trackElement.querySelectorAll(".carousel-slide").forEach((slideElement, index) => {
    slideElement.setAttribute("aria-hidden", index !== currentSlideIndex);
  });
  dotsElement.querySelectorAll(".carousel-dot").forEach((dot, index) => {
    dot.setAttribute("aria-current", index === currentSlideIndex);
  });

  statusElement.textContent = `Photo ${currentSlideIndex + 1} of ${SLIDES.length}: ${SLIDES[currentSlideIndex].caption}`;
}

function showNextSlide() {
  goToSlide(currentSlideIndex + 1);
}

function showPreviousSlide() {
  goToSlide(currentSlideIndex - 1);
}

function startAutoplay() {
  stopAutoplay();
  autoplayTimerId = setInterval(showNextSlide, AUTOPLAY_DELAY_MS);
}

function stopAutoplay() {
  clearInterval(autoplayTimerId);
  autoplayTimerId = null;
}

// After a manual change, give the user a full 4 seconds on the chosen slide
function restartAutoplay() {
  if (!isPaused) {
    startAutoplay();
  }
}

function togglePause() {
  isPaused = !isPaused;

  if (isPaused) {
    stopAutoplay();
    toggleButton.textContent = "▶ Resume";
  } else {
    startAutoplay();
    toggleButton.textContent = "⏸ Pause";
  }
  toggleButton.setAttribute("aria-pressed", isPaused);
}

function initCarousel() {
  buildSlides();
  goToSlide(0);
  startAutoplay();

  document.getElementById("carousel-next").addEventListener("click", () => {
    showNextSlide();
    restartAutoplay();
  });

  document.getElementById("carousel-prev").addEventListener("click", () => {
    showPreviousSlide();
    restartAutoplay();
  });

  toggleButton.addEventListener("click", togglePause);

  // Left/right arrow keys work while focus is inside the carousel
  carouselElement.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      showNextSlide();
      restartAutoplay();
    } else if (event.key === "ArrowLeft") {
      showPreviousSlide();
      restartAutoplay();
    }
  });
}

initCarousel();
