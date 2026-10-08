/**
 * Official UFRGS undergraduate courses (Cursos de Graduação).
 */
export const UFRGS_COURSES: readonly string[] = [
  "Administração",
  "Administração Pública e Social",
  "Agronomia",
  "Arqueologia",
  "Arquitetura e Urbanismo",
  "Arquivologia",
  "Artes Cênicas",
  "Artes Visuais",
  "Bacharelado Interdisciplinar em Ciência e Tecnologia",
  "Biblioteconomia",
  "Biomedicina",
  "Biotecnologia",
  "Ciência da Computação",
  "Ciência de Dados e Inteligência Artificial",
  "Ciências Atuariais",
  "Ciências Biológicas",
  "Ciências Contábeis",
  "Ciências Econômicas",
  "Ciências Sociais",
  "Comunicação Social: Jornalismo",
  "Comunicação Social: Publicidade e Propaganda",
  "Comunicação Social: Relações Públicas",
  "Dança",
  "Design de Produto",
  "Design Visual",
  "Desenvolvimento Regional",
  "Desenvolvimento Rural",
  "Direito",
  "Educação do Campo",
  "Educação Física",
  "Enfermagem",
  "Engenharia Ambiental",
  "Engenharia Cartográfica",
  "Engenharia Civil",
  "Engenharia de Alimentos",
  "Engenharia de Computação",
  "Engenharia de Controle e Automação",
  "Engenharia de Energia",
  "Engenharia de Gestão de Energia",
  "Engenharia de Materiais",
  "Engenharia de Minas",
  "Engenharia de Produção",
  "Engenharia de Serviços",
  "Engenharia Elétrica",
  "Engenharia Física",
  "Engenharia Mecânica",
  "Engenharia Metalúrgica",
  "Engenharia Química",
  "Estatística",
  "Farmácia",
  "Filosofia",
  "Física",
  "Física Médica",
  "Fisioterapia",
  "Fonoaudiologia",
  "Geografia",
  "Geologia",
  "Gestão Ambiental",
  "História",
  "História da Arte",
  "Jornalismo",
  "Letras",
  "Matemática",
  "Medicina",
  "Medicina Veterinária",
  "Museologia",
  "Música",
  "Nutrição",
  "Odontologia",
  "Pedagogia",
  "Políticas Públicas",
  "Psicologia",
  "Publicidade e Propaganda",
  "Química",
  "Química Industrial",
  "Relações Internacionais",
  "Relações Públicas",
  "Saúde Coletiva",
  "Serviço Social",
  "Teatro",
  "Zootecnia",
] as const;

export function normalizeCourseName(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Finds a matching course in the list ignoring case and accents.
 * e.g. "ciencia da computacao" -> "Ciência da Computação"
 */
export function findCanonicalCourseName(input: string): string | undefined {
  const normalized = normalizeCourseName(input);
  if (!normalized) return undefined;
  return UFRGS_COURSES.find((c) => normalizeCourseName(c) === normalized);
}

/**
 * Filters courses by query ignoring case and accents.
 */
export function filterCourses(query: string): string[] {
  const normalized = normalizeCourseName(query);
  if (!normalized) return [...UFRGS_COURSES];
  return UFRGS_COURSES.filter((c) => normalizeCourseName(c).includes(normalized));
}
