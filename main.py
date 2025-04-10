from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import folium
from folium.plugins import MarkerCluster
import os
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key")
CSV_FILE = "enderecos.csv"

# Dados de exemplo (latitude, longitude, cidade, estado, endereço)
enderecos = [
    {"lat": -23.55052, "lon": -46.633308, "cidade": "São Paulo", "estado": "SP", "endereco": "Av. Paulista, 1000"},
    {"lat": -22.906847, "lon": -43.172897, "cidade": "Rio de Janeiro", "estado": "RJ", "endereco": "Copacabana, 200"},
    {"lat": -19.916681, "lon": -43.934493, "cidade": "Belo Horizonte", "estado": "MG", "endereco": "Praça da Liberdade, 300"},
    {"lat": -25.4284, "lon": -49.2733, "cidade": "Curitiba", "estado": "PR", "endereco": "R. XV de Novembro, 100"},
    {"lat": -30.0277, "lon": -51.2287, "cidade": "Porto Alegre", "estado": "RS", "endereco": "Av. Borges de Medeiros, 500"},
    {"lat": -16.6799, "lon": -49.255, "cidade": "Goiânia", "estado": "GO", "endereco": "Av. Goiás, 400"},
    {"lat": -3.7327, "lon": -38.5270, "cidade": "Fortaleza", "estado": "CE", "endereco": "Av. Beira Mar, 600"},
    {"lat": -8.0476, "lon": -34.8770, "cidade": "Recife", "estado": "PE", "endereco": "Av. Boa Viagem, 700"}
]

# Criar mapa interativo
def criar_mapa(enderecos_filtrados=None):
    mapa = folium.Map(location=[-15.7801, -47.9292], zoom_start=5)
    marker_cluster = MarkerCluster().add_to(mapa)
    
    # Usar endereços filtrados se fornecidos, caso contrário usar todos os endereços
    lista_enderecos = enderecos_filtrados if enderecos_filtrados else enderecos
    
    for endereco in lista_enderecos:
        # Verificar se o endereço já tem uma preferência salva
        cidade = endereco["cidade"]
        estado = endereco["estado"]
        endereco_rua = endereco["endereco"]
        
        # Definir cor do marcador baseado na existência de preferência
        preferencia_existe = tem_preferencia(cidade, estado, endereco_rua)
        cor_marcador = 'green' if preferencia_existe else 'red'
        
        # Definir classe do botão baseado na existência de preferência
        classe_botao = 'btn-success' if preferencia_existe else 'btn-danger'
        
        # Texto adicional se já tiver preferência
        texto_status = '<span class="text-success">✓ Avaliado</span>' if preferencia_existe else '<span class="text-danger">Não avaliado</span>'
        
        folium.Marker(
            location=[endereco["lat"], endereco["lon"]],
            popup=f"""
            <div>
                <strong>{cidade}, {estado}</strong><br>
                {endereco_rua}<br>
                {texto_status}<br>
                <button class='btn btn-sm {classe_botao} select-endereco' 
                data-cidade='{cidade}' 
                data-estado='{estado}' 
                data-endereco='{endereco_rua}'>
                Selecionar
                </button>
            </div>
            """,
            tooltip=f"{cidade}, {estado}",
            icon=folium.Icon(color=cor_marcador)
        ).add_to(marker_cluster)
    
    # Salvar mapa
    mapa.save("static/mapa.html")
    
    # Adicionar código JavaScript para comunicação entre iframe e página principal
    with open("static/mapa.html", "r") as file:
        conteudo = file.read()
    
    # Código JavaScript para manipular cliques nos botões
    script_comunicacao = """
    <script>
    // Função para enviar dados para a página pai quando um botão é clicado
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('select-endereco')) {
            var cidade = e.target.getAttribute('data-cidade');
            var estado = e.target.getAttribute('data-estado');
            var endereco = e.target.getAttribute('data-endereco');
            
            // Enviar mensagem para a página pai
            window.parent.postMessage({
                type: 'enderecoSelecionado',
                cidade: cidade,
                estado: estado,
                endereco: endereco
            }, '*');
        }
    });
    </script>
    """
    
    # Adicionar o script antes do fechamento do body
    conteudo = conteudo.replace("</body>", script_comunicacao + "</body>")
    
    # Salvar o arquivo modificado
    with open("static/mapa.html", "w") as file:
        file.write(conteudo)
    
    return "static/mapa.html"

# Função para carregar dados do CSV
def carregar_csv():
    if os.path.exists(CSV_FILE):
        return pd.read_csv(CSV_FILE)
    # Criar um DataFrame vazio com as colunas necessárias
    return pd.DataFrame(columns=["cidade", "estado", "endereco", "preferencia"])

# Função para verificar se um endereço já tem preferência definida
def tem_preferencia(cidade, estado, endereco):
    df = carregar_csv()
    filtro = (
        (df["cidade"] == cidade) & 
        (df["estado"] == estado) & 
        (df["endereco"] == endereco)
    )
    return filtro.any()

# Rota principal
@app.route("/")
def index():
    criar_mapa()
    return render_template("index.html")

# Rota para obter endereços filtrados
@app.route("/get_enderecos", methods=["POST"])
def get_enderecos():
    data = request.get_json()
    cidade = data.get("cidade")
    estado = data.get("estado")
    
    enderecos_filtrados = [e for e in enderecos if e["cidade"] == cidade and e["estado"] == estado]
    return jsonify(enderecos_filtrados)

# Rota para pesquisar endereços
@app.route("/pesquisar_enderecos", methods=["POST"])
def pesquisar_enderecos():
    data = request.get_json()
    termo_pesquisa = data.get("termo_pesquisa", "").lower()
    
    if not termo_pesquisa:
        return jsonify({"enderecos": enderecos, "mapa_url": criar_mapa()})
    
    # Filtrar endereços que correspondem ao termo de pesquisa
    enderecos_filtrados = []
    for endereco in enderecos:
        # Verificar se o termo de pesquisa está presente na cidade, estado ou endereço
        if (termo_pesquisa in endereco["cidade"].lower() or 
            termo_pesquisa in endereco["estado"].lower() or 
            termo_pesquisa in endereco["endereco"].lower()):
            enderecos_filtrados.append(endereco)
    
    # Gerar novo mapa com os endereços filtrados
    mapa_url = criar_mapa(enderecos_filtrados)
    
    return jsonify({
        "enderecos": enderecos_filtrados,
        "mapa_url": mapa_url,
        "total_resultados": len(enderecos_filtrados)
    })

# Rota para salvar preferência
@app.route("/salvar_preferencia", methods=["POST"])
def salvar_preferencia():
    data = request.get_json()
    logging.debug(f"Dados recebidos para salvar: {data}")
    
    # Validar dados recebidos
    if not all(key in data for key in ["cidade", "estado", "endereco", "preferencia"]):
        return jsonify({"status": "error", "message": "Dados incompletos"}), 400
    
    # Verificar se a preferência está no intervalo permitido
    try:
        preferencia = int(data["preferencia"])
        if preferencia < 1 or preferencia > 5:
            return jsonify({"status": "error", "message": "Preferência deve ser entre 1 e 5"}), 400
    except ValueError:
        return jsonify({"status": "error", "message": "Preferência deve ser um número"}), 400
    
    # Carregar dados existentes
    df = carregar_csv()
    
    # Verificar se o endereço já existe
    filtro = (
        (df["cidade"] == data["cidade"]) & 
        (df["estado"] == data["estado"]) & 
        (df["endereco"] == data["endereco"])
    )
    
    if filtro.any():
        # Atualizar preferência se o endereço já existe
        df.loc[filtro, "preferencia"] = data["preferencia"]
    else:
        # Adicionar novo registro
        nova_linha = pd.DataFrame([data])
        df = pd.concat([df, nova_linha], ignore_index=True)
    
    # Salvar no CSV
    df.to_csv(CSV_FILE, index=False)
    
    # Recriar o mapa para atualizar as cores dos marcadores
    mapa_url = criar_mapa()
    
    return jsonify({
        "status": "success", 
        "message": "Preferência salva com sucesso",
        "mapa_url": mapa_url
    })

# Rota para obter preferências salvas
@app.route("/get_preferencias")
def get_preferencias():
    df = carregar_csv()
    return jsonify(df.to_dict(orient='records'))

# Rota para baixar o CSV de preferências
@app.route("/download_preferencias")
def download_preferencias():
    if os.path.exists(CSV_FILE):
        return send_file(CSV_FILE, 
                         mimetype='text/csv',
                         download_name='preferencias_enderecos.csv',
                         as_attachment=True)
    else:
        return jsonify({"error": "Arquivo CSV não encontrado"}), 404

# Rota para limpar o CSV de preferências
@app.route("/limpar_preferencias", methods=["POST"])
def limpar_preferencias():
    # Cria um DataFrame vazio com as colunas necessárias
    df_empty = pd.DataFrame(columns=["cidade", "estado", "endereco", "preferencia"])
    # Salva o DataFrame vazio no CSV
    df_empty.to_csv(CSV_FILE, index=False)
    # Atualiza o mapa para refletir as mudanças
    mapa_url = criar_mapa()
    return jsonify({"status": "success", "message": "Lista de preferências limpa com sucesso", "mapa_url": mapa_url})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
