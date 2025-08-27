# Portfolio Website

A clean, minimalist portfolio website inspired by Joshua Guo's design at [v2space.net](https://v2space.net/). This website features a modern, responsive design with smooth animations and interactive elements.

## Features

- **Clean, Minimalist Design** - Following the principle of "form follows function"
- **Responsive Layout** - Works perfectly on all devices
- **Smooth Animations** - Fade-in effects and hover animations
- **Interactive Elements** - Hover effects, click animations, and smooth scrolling
- **Accessibility** - Keyboard navigation support and focus indicators
- **Modern Technologies** - HTML5, CSS3, and vanilla JavaScript
- **Performance Optimized** - Lightweight and fast loading

## File Structure

```
├── index.html          # Main HTML structure
├── styles.css          # CSS styling and responsive design
├── script.js           # JavaScript functionality and animations
└── README.md           # This documentation file
```

## Customization Guide

### 1. Personal Information
Edit `index.html` to update:
- Your name and title
- Profile picture (replace placeholder image)
- About me section
- Company logos in "Trusted by" section
- Project details and descriptions
- Tech stack items

### 2. Profile Picture
Replace the placeholder image URL in `index.html`:
```html
<img src="path/to/your/image.jpg" alt="Your Profile Picture" class="profile-pic">
```

### 3. Projects Section
Update the project cards with your own projects:
```html
<div class="project-card">
    <h3>Your Project Name</h3>
    <p>Your project description here.</p>
    <div class="project-tags">
        <span class="tag">Category</span>
        <span class="tag">Technology</span>
    </div>
</div>
```

### 4. Tech Stack
Modify the tech stack section to include your technologies:
```html
<div class="tech-item">
    <i class="fab fa-your-tech-icon"></i>
    <span>Technology Name</span>
</div>
```

### 5. Company Logos
Update the "Trusted by" section with actual company names or logos:
```html
<div class="company-logo">Company Name</div>
```

### 6. Colors and Styling
Customize colors in `styles.css`:
- Primary color: `#6366f1` (currently indigo)
- Background colors: `#f9fafb`, `#ffffff`
- Text colors: `#1f2937`, `#6b7280`
- Border colors: `#e5e7eb`, `#d1d5db`

### 7. Fonts
The website uses Inter font by default. You can change this in `styles.css`:
```css
body {
    font-family: 'Your Font', sans-serif;
}
```

## Adding New Features

### Contact Form
To add a contact form, add this HTML before the footer:
```html
<section class="contact-section">
    <h2>Get in Touch</h2>
    <form id="contact-form">
        <input type="text" name="name" placeholder="Your Name" required>
        <input type="email" name="email" placeholder="Your Email" required>
        <textarea name="message" placeholder="Your Message" required></textarea>
        <button type="submit">Send Message</button>
    </form>
</section>
```

### Dark Mode Toggle
Add this button in the header:
```html
<button id="dark-mode-toggle" aria-label="Toggle dark mode">
    <i class="fas fa-moon"></i>
</button>
```

### Navigation Menu
Add a navigation menu for better user experience:
```html
<nav class="main-nav">
    <a href="#about">About</a>
    <a href="#projects">Projects</a>
    <a href="#tech">Tech Stack</a>
    <a href="#contact">Contact</a>
</nav>
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Internet Explorer 11+ (with some limitations)

## Performance Tips

1. **Optimize Images** - Use WebP format and appropriate sizes
2. **Minimize CSS/JS** - Consider minifying for production
3. **Lazy Loading** - Implement lazy loading for images if you have many
4. **CDN** - Use CDN for external resources like Font Awesome

## Deployment

### GitHub Pages
1. Push your code to a GitHub repository
2. Go to Settings > Pages
3. Select source branch (usually `main`)
4. Your site will be available at `https://username.github.io/repository-name`

### Netlify
1. Drag and drop your project folder to Netlify
2. Or connect your GitHub repository
3. Your site will be deployed automatically

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your project directory
3. Follow the prompts to deploy

## Customization Examples

### Different Color Schemes

**Blue Theme:**
```css
:root {
    --primary-color: #3b82f6;
    --accent-color: #1d4ed8;
}
```

**Green Theme:**
```css
:root {
    --primary-color: #10b981;
    --accent-color: #059669;
}
```

**Purple Theme:**
```css
:root {
    --primary-color: #8b5cf6;
    --accent-color: #7c3aed;
}
```

### Adding Social Links
Add social media links in the profile section:
```html
<div class="social-links">
    <a href="https://github.com/yourusername" target="_blank" rel="noopener">
        <i class="fab fa-github"></i>
    </a>
    <a href="https://linkedin.com/in/yourusername" target="_blank" rel="noopener">
        <i class="fab fa-linkedin"></i>
    </a>
    <a href="https://twitter.com/yourusername" target="_blank" rel="noopener">
        <i class="fab fa-twitter"></i>
    </a>
</div>
```

## Troubleshooting

### Common Issues

1. **Font Awesome Icons Not Showing**
   - Check if the CDN link is working
   - Verify the icon class names

2. **Animations Not Working**
   - Ensure JavaScript is enabled
   - Check browser console for errors

3. **Responsive Issues**
   - Test on different screen sizes
   - Check CSS media queries

4. **Performance Issues**
   - Optimize images
   - Minify CSS and JavaScript
   - Use browser dev tools to identify bottlenecks

## Contributing

Feel free to fork this project and customize it for your needs. If you make improvements that could benefit others, consider submitting a pull request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Credits

- Design inspiration: [Joshua Guo's Portfolio](https://v2space.net/)
- Fonts: [Inter](https://rsms.me/inter/) by Rasmus Andersson
- Icons: [Font Awesome](https://fontawesome.com/)
- Placeholder images: [Placeholder.com](https://placeholder.com/)

---

**Happy coding! 🚀**
