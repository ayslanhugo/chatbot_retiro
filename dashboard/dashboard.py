# dashboard.py (versão com gestão de leads)
from flask import Flask, render_template, Response, request, jsonify
import gspread
import pandas as pd
import json
import os

app = Flask(__name__)
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), '..', 'credentials.json')
LEADS_PATH = os.path.join(os.path.dirname(__file__), '..', 'meu-bot', 'leads.json')

gc = gspread.service_account(filename=CREDENTIALS_PATH) 
spreadsheet = gc.open_by_key("1EMo7FlITs6MUzk8ODsLbjn4mroTnO3_thRkr0TfJylw")
worksheet = spreadsheet.worksheet("Página1")

@app.route('/')
def home():
    all_data = worksheet.get_all_records()
    if not all_data: df = pd.DataFrame()
    else: df = pd.DataFrame(all_data)
    total_inscritos = len(df)
    membros_efetivos = df[df['Efetivo'].str.lower() == 'sim'].shape[0] if 'Efetivo' in df.columns else 0
    visitantes = total_inscritos - membros_efetivos
    lista_de_inscritos = df.to_dict('records')

    datas_grafico, contagem_grafico = [], []
    if 'Data e Horário' in df.columns and not df.empty:
        df_dates = df.copy()
        df_dates['Data e Horário'] = pd.to_datetime(df_dates['Data e Horário'], format='%d/%m/%Y, %H:%M:%S', errors='coerce')
        df_dates.dropna(subset=['Data e Horário'], inplace=True)
        if not df_dates.empty:
            inscricoes_por_dia = df_dates['Data e Horário'].dt.date.value_counts().sort_index()
            datas_grafico = [data.strftime('%d/%m') for data in inscricoes_por_dia.index]
            contagem_grafico = list(inscricoes_por_dia.values)

    leads_data = {}
    try:
        with open(LEADS_PATH, 'r', encoding='utf-8') as f:
            leads_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        pass # Se o ficheiro não existe ou está vazio, leads_data continua a ser {}

    return render_template('dashboard.html', 
                           total=total_inscritos, efetivos=membros_efetivos, visitantes=visitantes,
                           inscritos=lista_de_inscritos,
                           datas_grafico_json=json.dumps(datas_grafico),
                           contagem_grafico_json=json.dumps(contagem_grafico),
                           leads=leads_data)

@app.route('/leads/delete', methods=['POST'])
def delete_lead():
    lead_id = request.json.get('lead_id')
    try:
        with open(LEADS_PATH, 'r+', encoding='utf-8') as f:
            leads = json.load(f)
            if lead_id in leads:
                del leads[lead_id]
                f.seek(0); f.truncate()
                json.dump(leads, f, indent=4)
                return jsonify({'success': True})
        return jsonify({'success': False, 'message': 'Lead não encontrado'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/leads/update', methods=['POST'])
def update_lead():
    data = request.json
    lead_id, novo_nome = data.get('lead_id'), data.get('novo_nome')
    try:
        with open(LEADS_PATH, 'r+', encoding='utf-8') as f:
            leads = json.load(f)
            if lead_id in leads:
                leads[lead_id]['nome'] = novo_nome
                f.seek(0); f.truncate()
                json.dump(leads, f, indent=4)
                return jsonify({'success': True, 'novo_nome': novo_nome})
        return jsonify({'success': False, 'message': 'Lead não encontrado'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/export/csv')
def export_csv():
    all_data = worksheet.get_all_records()
    if not all_data: return "Nenhum dado para exportar.", 404
    df = pd.DataFrame(all_data)
    csv_data = df.to_csv(index=False, encoding='utf-8-sig')
    return Response(csv_data, mimetype="text/csv", headers={"Content-disposition": "attachment; filename=lista_de_inscritos.csv"})

if __name__ == '__main__':
    app.run(debug=True, port=5001)