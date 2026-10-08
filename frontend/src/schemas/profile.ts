import { z } from 'zod';

export const profileSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  curso: z.string().min(2, "Curso inválido"),
  genero: z.string().optional(),
  foto_url: z.string().url("URL de foto inválida").optional(),
  redes_link: z.string().optional(),
  telefone: z.string().optional(),
  
  // Condicional para motorista
  is_driver: z.boolean(),
  carro_modelo: z.string().optional(),
  carro_placa: z.string().optional(),
});

export type ProfileFormInputs = z.infer<typeof profileSchema>;
