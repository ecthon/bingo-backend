import { v4 as uuidv4 } from 'uuid';

// Interface para guardar os dados extras de cada conexão socket
interface SocketData {
    id: string;
    nome?: string;
    sala?: string;
}

const server = Bun.serve<SocketData>({
    port: 3001,
    fetch(req, server) {
        // Tenta fazer o upgrade da requisição HTTP padrão para WebSocket
        const upgraded = server.upgrade(req, {
            data: {
                id: uuidv4(), // Atribui um ID único temporário para essa conexão
            },
        });

        if (upgraded) return undefined; // Upgrade deu certo

        return new Response("Por favor, conecte via WebSocket.", { status: 400 });
    },
    websocket: {
        // Executado assim que um cliente conecta com sucesso
        open(ws) {
            console.log(`[CONEXÃO] Cliente conectado. ID Temporário: ${ws.data.id}`);

            // Envia uma mensagem de boas-vindas confirmando a conexão
            ws.send(JSON.stringify({ type: 'CONECTADO', payload: { id: ws.data.id } }));
        },

        // Executado quando o servidor recebe uma mensagem do cliente
        message(ws, message) {
            try {
                const data = JSON.parse(message.toString());
                console.log(`[MENSAGEM RECEBIDA de ${ws.data.id}]:`, data);

                switch (data.type) {
                    case 'ENTRAR_SALA':
                        const { sala, nome } = data.payload;

                        // Atualiza os dados internos do socket
                        ws.data.sala = sala;
                        ws.data.nome = nome;

                        // Coloca esse socket em uma "sala" nativa do Bun
                        ws.subscribe(sala);

                        console.log(`[SALA] ${nome} entrou na sala: ${sala}`);

                        // Confirma para o usuário que ele entrou na sala
                        ws.send(JSON.stringify({
                            type: 'SALA_CONFIRMADA',
                            payload: { sala, nome }
                        }));

                        // Notifica os OUTROS participantes daquela sala que alguém entrou
                        ws.publish(sala, JSON.stringify({
                            type: 'NOVO_PARTICIPANTE',
                            payload: { nome }
                        }));
                        break;

                    default:
                        ws.send(JSON.stringify({ type: 'ERRO', payload: 'Ação não reconhecida.' }));
                }
            } catch (error) {
                ws.send(JSON.stringify({ type: 'ERRO', payload: 'Formato de mensagem inválido. Use JSON.' }));
            }
        },

        // Executado quando o cliente fecha a conexão ou perde o sinal
        close(ws, code, message) {
            console.log(`[DESCONEXÃO] Cliente ${ws.data.id} saiu.`);

            // Se ele estava em uma sala, avisa os outros participantes
            if (ws.data.sala && ws.data.nome) {
                server.publish(ws.data.sala, JSON.stringify({
                    type: 'PARTICIPANTE_SAIU',
                    payload: { nome: ws.data.nome }
                }));
            }
        },
    },
});

console.log(`🚀 Servidor de Bingo rodando em http://localhost:${server.port}`);
