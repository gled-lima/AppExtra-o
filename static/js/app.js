document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const preferenciaForm = document.getElementById('preferenciaForm');
    const cidadeField = document.getElementById('cidadeField');
    const estadoField = document.getElementById('estadoField');
    const enderecoField = document.getElementById('enderecoField');
    const salvarBtn = document.getElementById('salvarBtn');
    const preferenciaTable = document.getElementById('preferenciaTable');
    const semPreferencias = document.getElementById('semPreferencias');
    const mapFrame = document.getElementById('mapFrame');
    const limparBtn = document.getElementById('limparBtn');
    
    // Elementos de pesquisa
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
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
                
                // Atualizar o mapa com marcadores coloridos
                if (data.mapa_url) {
                    mapFrame.src = data.mapa_url + '?' + new Date().getTime(); // Evitar cache
                }
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
    
    // Função para pesquisar endereços
    function pesquisarEnderecos(termo) {
        fetch('/pesquisar_enderecos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ termo_pesquisa: termo })
        })
        .then(response => response.json())
        .then(data => {
            // Atualizar o iframe do mapa com o novo mapa gerado
            mapFrame.src = data.mapa_url + '?' + new Date().getTime(); // Adicionar timestamp para evitar cache
            
            // Mostrar quantidade de resultados ou mensagem se não encontrar
            if (data.total_resultados === 0) {
                mostrarNotificacao('Pesquisa', 'Nenhum endereço encontrado com o termo: ' + termo);
            } else {
                const mensagem = data.total_resultados === 1 ? 
                    '1 endereço encontrado' : 
                    `${data.total_resultados} endereços encontrados`;
                
                searchInput.placeholder = mensagem;
                
                // Resetar placeholder após 3 segundos
                setTimeout(() => {
                    searchInput.placeholder = 'Pesquisar endereço...';
                }, 3000);
            }
        })
        .catch(error => {
            console.error('Erro ao pesquisar endereços:', error);
            mostrarNotificacao('Erro', 'Ocorreu um erro ao pesquisar endereços.');
        });
    }
    
    // Event listener para o botão de pesquisa
    searchButton.addEventListener('click', function() {
        const termoPesquisa = searchInput.value.trim();
        if (termoPesquisa) {
            pesquisarEnderecos(termoPesquisa);
        } else {
            // Se o campo estiver vazio, recarregar todos os endereços
            pesquisarEnderecos('');
        }
    });
    
    // Event listener para pesquisar ao pressionar Enter no campo de pesquisa
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchButton.click();
        }
    });
    
    // Event listener para o botão de limpar lista
    limparBtn.addEventListener('click', function() {
        // Confirmar com o usuário antes de limpar
        if (confirm('Tem certeza que deseja limpar toda a lista de preferências? Esta ação não pode ser desfeita.')) {
            fetch('/limpar_preferencias', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    mostrarNotificacao('Sucesso', data.message || 'Lista de preferências limpa com sucesso!');
                    carregarPreferencias(); // Atualizar a tabela
                    
                    // Atualizar o mapa com marcadores atualizados
                    if (data.mapa_url) {
                        mapFrame.src = data.mapa_url + '?' + new Date().getTime(); // Evitar cache
                    }
                    
                    // Limpar o formulário de preferência
                    preferenciaForm.reset();
                    salvarBtn.disabled = true;
                } else {
                    mostrarNotificacao('Erro', data.message || 'Erro ao limpar lista de preferências.');
                }
            })
            .catch(error => {
                console.error('Erro ao limpar preferências:', error);
                mostrarNotificacao('Erro', 'Ocorreu um erro ao tentar limpar a lista de preferências.');
            });
        }
    });
    
    // Carregar preferências ao iniciar
    carregarPreferencias();
});