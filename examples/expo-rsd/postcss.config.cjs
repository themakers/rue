module.exports = {
  plugins: [
    require('react-strict-dom/postcss-plugin')({ include: ['**/*.{js,jsx,mjs,ts,tsx}'] }),
    require('autoprefixer'),
  ],
}
