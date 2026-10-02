import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido").endsWith("@ufrgs.br", "O e-mail deve ser do domínio @ufrgs.br"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

export type LoginFormInputs = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido").endsWith("@ufrgs.br", "O e-mail deve ser do domínio @ufrgs.br"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  curso: z.string().min(2, "Curso inválido"),
  is_driver: z.boolean(),
});

export type RegisterFormInputs = z.infer<typeof registerSchema>;
