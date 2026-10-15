/**
 * Assets & links — replace placeholders when finals are ready.
 */
window.ANTENADOS = {
  checkoutUrl: "https://pay.hotmart.com/W107810196M?checkoutMode=10",
  whatsappUrl: "https://wa.me/5535997160702",
  whatsappDisplay: "(35) 99716-0702",
  vsl: {
    videoSrc: "videos/vsl.mp4",
    posterSrc: "images/vsl-poster.jpg",
  },
  instructorPhoto: "images/matheus-paiva.jpg",
  aula: {
    introVideoId: "6VkzQVNDeX0",
    lessonVideoId: "_RDDF9B3dfA",
    coverSrc: "videos/thumb.mp4",
    // Preencher depois do corte, em segundos.
    // action "intent" grava o clique e fica na página.
    // action "checkout" grava e abre a Hotmart. O último momento deve ser checkout.
    // Exemplo: { at: 480, id: "uso", action: "intent" }
    cues: [],
  },
  testimonials: [
    {
      name: "Mara",
      detail: "58 anos",
      quote:
        "Achei que IA era coisa de jovem. Na primeira aula já consegui pedir ajuda para uma mensagem.",
      videoSrc: "",
      photoSrc: "images/testimonial-mara.jpg",
    },
    {
      name: "Joel",
      detail: "72 anos",
      quote:
        "As aulas são curtas e no celular. Usei para entender uma carta do banco sem pedir ajuda.",
      videoSrc: "",
      photoSrc: "images/testimonial-joel.jpg",
    },
    {
      name: "Anelise",
      detail: "61 anos",
      quote:
        "O módulo anti-golpe me deixou mais segura. Agora penso duas vezes antes de clicar em link.",
      videoSrc: "",
      photoSrc: "images/testimonial-anelise.jpg",
    },
  ],
};
