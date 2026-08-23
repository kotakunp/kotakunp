import type { ComponentType, SVGProps } from "react";
import { socialLinks } from "@/content/site";
import {
  AppleMusicBrandIcon,
  DuuToIcon,
  FacebookBrandIcon,
  InstagramBrandIcon,
  SpotifyBrandIcon,
  YouTubeBrandIcon,
} from "./brand-icons";

type BrandIcon = ComponentType<SVGProps<SVGSVGElement>>;

const socialIcons: Record<(typeof socialLinks)[number]["icon"], BrandIcon> = {
  video: YouTubeBrandIcon,
  users: FacebookBrandIcon,
  disc: SpotifyBrandIcon,
  music: AppleMusicBrandIcon,
  camera: InstagramBrandIcon,
  link: DuuToIcon,
};

function SocialIcon({ name }: { name: (typeof socialLinks)[number]["icon"] }) {
  const Icon = socialIcons[name];
  return <Icon aria-hidden="true" data-brand={name} />;
}

export function SocialLinks({ soonLabel }: { soonLabel: string }) {
  return (
    <ul className="social-links" aria-label="Social links">
      {socialLinks.map((social) => (
        <li key={social.label}>
          {social.href ? (
            <a href={social.href} target="_blank" rel="noreferrer" aria-label={social.label}>
              <span className="social-mark" aria-hidden="true"><SocialIcon name={social.icon} /></span>
              <span>{social.label}</span>
            </a>
          ) : (
            <span className="social-pending" aria-label={`${social.label}: ${soonLabel}`}>
              <span className="social-mark" aria-hidden="true"><SocialIcon name={social.icon} /></span>
              <span>{social.label}</span><small>{soonLabel}</small>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
