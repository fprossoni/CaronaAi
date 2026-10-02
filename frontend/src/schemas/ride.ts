import { z } from 'zod';

export const createRideSchema = z.object({
  origem_endereco: z.string().min(5, "Endereço de origem inválido"),
  destino_endereco: z.string().min(5, "Endereço de destino inválido"),
  horario_saida: z.string().datetime("Horário de saída inválido"),
  tolerancia_atraso_minutos: z.number().min(0).max(60),
  vagas_disponiveis: z.number().min(1).max(7),
  somente_mulheres: z.boolean().default(false),
});

export type CreateRideFormInputs = z.infer<typeof createRideSchema>;
