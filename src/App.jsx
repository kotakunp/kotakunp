import {
  FacebookIcon,
  YoutubeIcon,
  MailIcon,
  InstagramIcon,
} from "lucide-react";

import Carousel from "./components/Carousel";

export default function App() {
  return (
    <div className="font-sans bg-white text-black">
      {/* Navbar */}
      <nav className="fixed w-full bg-white/50 shadow-xl backdrop-blur p-4 flex justify-center gap-6">
        <a href="#about" className="hover:text-purple-400">
          About
        </a>
        <a href="#discography" className="hover:opacity-50">
          Works
        </a>
        <a href="#gallery" className="hover:text-purple-400">
          Gallery
        </a>
        <a href="#contact" className="hover:text-purple-400">
          Contact
        </a>
      </nav>

      {/* About */}
      <section
        id="about"
        className="min-h-screen flex flex-col items-center justify-center px-6"
      >
        <h2 className="text-3xl font-bold inter-title mb-4">kotakunp</h2>
        <p className="max-w-2xl text-center">
          Me make trash music, avoid at all cost!
        </p>
      </section>

      {/* Discography */}
      <section
        id="discography"
        className="min-h-screen flex flex-col items-center justify-center px-6"
      >
        <h2 className="text-3xl font-bold mb-6">Works</h2>
        <div className="flex flex-col space-y-6 w-full max-w-xl">
          <iframe
            className="flex w-full h-60 rounded-xl"
            src="https://open.spotify.com/embed/track/your-track-id"
            allow="encrypted-media"
          />
          <iframe
            className="flex w-full h-60 rounded-xl"
            src="https://www.youtube.com/embed/d3JBr5WQ1MQ?si=RqpPkdQbRK4hX96s"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
          />
          <Carousel
            baseWidth={575}
            baseHeight={250}
            autoplay={true}
            autoplayDelay={3000}
            pauseOnHover={true}
            loop={true}
            round={false}
          />
        </div>
      </section>

      {/* Gallery */}
      <section
        id="gallery"
        className="min-h-screen flex flex-col items-center justify-center px-6"
      >
        <h2 className="text-3xl font-bold mb-6">Gallery</h2>
        <div style={{ height: "600px", position: "relative" }}>BLA BLA</div>
      </section>

      {/* Contact */}
      <footer className="bg-black text-white py-8 mt-16">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <p className="text-lg font-semibold">Connect</p>
          <div className="flex gap-6">
            <a
              href="https://www.facebook.com/kotakunp"
              target="_blank"
              className="hover:text-blue-700 transition"
            >
              <FacebookIcon size={28} />
            </a>
            <a
              href="https://youtube.com/kotakunp"
              target="_blank"
              className="hover:text-red-500 transition"
            >
              <YoutubeIcon size={28} />
            </a>
            <a
              href="https://instagram.com/kota_harapeco"
              className="hover:text-pink-600 transition"
            >
              <InstagramIcon size={28} />
            </a>
            <a
              href="mailto:kotakunp@gmail.com"
              className="hover:text-green-400 transition"
            >
              <MailIcon size={28} />
            </a>
          </div>
          <p className="text-sm text-gray-400 mt-4">
            © {new Date().getFullYear()} kotakunp — made with Logic Pro X.
          </p>
        </div>
      </footer>
    </div>
  );
}
