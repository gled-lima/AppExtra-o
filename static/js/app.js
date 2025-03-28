document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const preferenciaForm = document.getElementById('preferenciaForm');
    const cidadeField = document.getElementById('cidadeField');
    const estadoField = document.getElementById('estadoField');
    const enderecoField = document.getElementById('enderecoField');
    const salvarBtn = document.getElementById('salvarBtn');
    const preferenciaTable = document.getElementById('preferenciaTable');
    const semPreferencias = document.getElementById('semPreferencias');
    
    // Modal de notificação
    const notificationModal = new bootstrap.Modal(document.getElementById('notificationModal'));
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    
    // Inicializar ouvinte para mensagens da iframe do mapa
    window.addEventListener('message', function(event) {
        console.log('Mensagem recebida do iframe:', event.data);
        
        // Verificar se a mensagem é do tipo esperado
        if (event.data && event.data.type === 'enderecoSelecionado') {
            // Preencher o formulário com os dados recebidos
            cidadeField.value = event.data.cidade;
            estadoField.value = event.data.estado;
            enderecoField.value = event.data.endereco;
            
            // Habilitar o botão de salvar
            salvarBtn.disabled = false;
            
            // Verificar se já existe uma preferência para este endereço
            buscarPreferenciaExistente(event.data.cidade, event.data.estado, event.data.endereco);
        }
    });
    
    // Função para buscar preferência existente para o endereço selecionado
    function buscarPreferenciaExistente(cidade, estado, endereco) {
        fetch('/get_preferencias')
            .then(response => response.json())
            .then(data => {
                const preferencia = data.find(item => 
                    item.cidade === cidade && 
                    item.estado === estado && 
                    item.endereco === endereco
                );
                
                if (preferencia) {
                    // Selecionar a estrela correspondente à preferência
                    const radio = document.querySelector(`input[name="preferencia"][value="${preferencia.preferencia}"]`);
                    if (radio) {
                        radio.checked = true;
                    }
                } else {
                    // Limpar seleções anteriores
                    const radios = document.querySelectorAll('input[name="preferencia"]');
                    radios.forEach(radio => {
                        radio.checked = false;
                    });
                }
            })
            .catch(error => {
                console.error('Erro ao buscar preferências:', error);
                mostrarNotificacao('Erro', 'Não foi possível carregar as preferências salvas.');
            });
    }
    
    // Submissão do formulário de preferência
    preferenciaForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Obter valor da preferência selecionada
        const preferenciaValue = document.querySelector('input[name="preferencia"]:checked');
        
        if (!preferenciaValue) {
            mostrarNotificacao('Atenção', 'Selecione uma preferência de 1 a 5 estrelas.');
            return;
        }
        
        const dados = {
            cidade: cidadeField.value,
            estado: estadoField.value,
            endereco: enderecoField.value,
            preferencia: preferenciaValue.value
        };
        
        // Enviar dados para o backend
        fetch('/salvar_preferencia', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                mostrarNotificacao('Sucesso', 'Preferência salva com sucesso!');
                carregarPreferencias(); // Atualizar a tabela
            } else {
                mostrarNotificacao('Erro', data.message || 'Erro ao salvar preferência.');
            }
        })
        .catch(error => {
            console.error('Erro ao salvar preferência:', error);
            mostrarNotificacao('Erro', 'Ocorreu um erro ao tentar salvar a preferência.');
        });
    });
    
    // Carregar preferências salvas
    function carregarPreferencias() {
        fetch('/get_preferencias')
            .then(response => response.json())
            .then(data => {
                // Limpar tabela
                const tbody = preferenciaTable.querySelector('tbody');
                tbody.innerHTML = '';
                
                if (data.length > 0) {
                    // Esconder mensagem de nenhuma preferência
                    semPreferencias.style.display = 'none';
                    preferenciaTable.style.display = 'table';
                    
                    // Preencher tabela com os dados
                    data.forEach(item => {
                        const tr = document.createElement('tr');
                        
                        // Criar células
                        const tdCidade = document.createElement('td');
                        tdCidade.textContent = `${item.cidade}, ${item.estado}`;
                        
                        const tdEndereco = document.createElement('td');
                        tdEndereco.textContent = item.endereco;
                        
                        const tdPreferencia = document.createElement('td');
                        tdPreferencia.innerHTML = criarEstrelas(item.preferencia);
                        
                        // Adicionar células à linha
                        tr.appendChild(tdCidade);
                        tr.appendChild(tdEndereco);
                        tr.appendChild(tdPreferencia);
                        
                        // Adicionar linha ao tbody
                        tbody.appendChild(tr);
                    });
                } else {
                    // Mostrar mensagem de nenhuma preferência
                    semPreferencias.style.display = 'block';
                    preferenciaTable.style.display = 'none';
                }
            })
            .catch(error => {
                console.error('Erro ao carregar preferências:', error);
                mostrarNotificacao('Erro', 'Não foi possível carregar as preferências salvas.');
            });
    }
    
    // Função para criar representação em estrelas da preferência
    function criarEstrelas(valor) {
        let estrelas = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= valor) {
                estrelas += '<i class="fas fa-star preferencia-stars"></i>';
            } else {
                estrelas += '<i class="far fa-star estrela-vazia"></i>';
            }
        }
        return estrelas;
    }
    
    // Função para mostrar notificação
    function mostrarNotificacao(titulo, mensagem) {
        modalTitle.textContent = titulo;
        modalMessage.textContent = mensagem;
        notificationModal.show();
    }
    
    // Carregar preferências ao iniciar
    carregarPreferencias();
});