/**
 * Fontes dos templates premium de PDF.
 *
 * Carregadas por `next/font/google`, que baixa os arquivos em tempo de BUILD e
 * os serve do próprio domínio. Isso não é preferência de performance: o PDF é
 * gerado rasterizando a prévia com html2canvas, e uma fonte vinda de um domínio
 * de terceiros entraria como recurso cross-origin — o snapshot sairia com a
 * fonte de fallback e o documento não bateria com a prévia.
 *
 * Exportamos o `style.fontFamily` já resolvido (e não a classe CSS) porque os
 * templates são estilizados inline: o valor literal chega ao style computado
 * sem depender de custom property, que o html2canvas resolve mal.
 *
 * Cada família inclui um fallback da mesma categoria — se por algum motivo o
 * arquivo não pintar a tempo, o documento degrada para um tipo parecido em vez
 * de cair no sans-serif do sistema.
 */
import {
  Playfair_Display,
  DM_Sans,
  Space_Grotesk,
  JetBrains_Mono,
  Archivo,
  Archivo_Narrow,
} from "next/font/google";

// --- Atelier Noir: editorial de luxo ----------------------------------------
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// --- Blueprint Técnico: spec sheet ------------------------------------------
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// --- Swiss Studio: cartaz tipográfico ---------------------------------------
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "900"],
  display: "swap",
});

const archivoNarrow = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

/** Famílias prontas para uso em `style={{ fontFamily: ... }}`. */
export const FONTES = {
  playfair: `${playfair.style.fontFamily}, "Times New Roman", serif`,
  dmSans: `${dmSans.style.fontFamily}, Helvetica, Arial, sans-serif`,
  spaceGrotesk: `${spaceGrotesk.style.fontFamily}, Helvetica, Arial, sans-serif`,
  jetbrainsMono: `${jetbrainsMono.style.fontFamily}, "Courier New", monospace`,
  archivo: `${archivo.style.fontFamily}, "Arial Black", Helvetica, sans-serif`,
  archivoNarrow: `${archivoNarrow.style.fontFamily}, "Arial Narrow", Helvetica, sans-serif`,
} as const;
