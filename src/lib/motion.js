export const pageContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};
