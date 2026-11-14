

## Matching por horário desejado

Novos clientes enviam `desired_pickup_at` (ISO 8601 com fuso) na busca e nas
solicitações individuais/em lote. A data e hora representam o embarque do
passageiro, não a saída do motorista nem a chegada ao destino. Clientes antigos
podem continuar enviando `pickup_after` e `pickup_before`; não misture os formatos.

A busca utiliza OSRM Table (`duration,distance`) em lotes direcionais. Solicitação
e aceite recalculam com OSRM Route. A indisponibilidade mantém o fallback existente
por Haversine a 30 km/h; ele é aproximado, sem trânsito. O aceite de uma rota com
paradas continua exigindo uma geometria retornada pelo roteador.

Limites padrão: diferença de horário de até 2h antes/depois, desvio incremental de
até 10 km e até 2h adicionais. O tempo entre saída do motorista e embarque também
é limitado a 2h. O filtro geográfico passa a usar 10 km. São limites inclusivos,
configuráveis em `.env`; pedidos antigos preservam seus intervalos gravados.

Custo (menor primeiro):
`0.45 * (diferenca_seg / 600)^2 + 0.40 * (desvio_m / 2000)^2 + 0.15 * (desvio_seg / 300)^2`.
Os pesos `MATCH_*_WEIGHT` e escalas `MATCH_*_SCALE_*` estão em `.env.example`.
O desvio é relativo à rota atual com passageiros confirmados. A resposta inclui
`match_cost` e `pickup_difference_seconds` (negativo significa antecipação).

A solicitação guarda o horário desejado e a previsão recalculada pelo Route.
Seu intervalo de compromisso fica restrito a ±5 min dessa previsão, intersectado
com os limites da busca; o aceite e novas paradas respeitam esse intervalo fixo.
A posição de inserção continua usando a heurística geográfica existente.

Antes de iniciar a versão atualizada, execute `alembic upgrade head` no backend.
A migração adiciona campos opcionais sem modificar os acordos históricos.
