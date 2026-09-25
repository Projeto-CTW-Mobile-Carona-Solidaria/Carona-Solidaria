package br.com.caronasolidaria.desktop;

import com.fasterxml.jackson.databind.JsonNode;
import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.awt.event.*;
import java.util.*;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.function.Consumer;

/** Native desktop client: HTTP work runs outside Swing's event dispatch thread. */
public final class DesktopApp {
    private final JFrame frame=new JFrame("Carona Solidária | Administração");
    private final JLabel status=new JLabel("Conecte-se para começar.");
    private ApiClient api;
    private JsonNode user;
    private int generation;
    private static final Color NAVY=new Color(1,41,111), BG=new Color(244,246,251);
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try { UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName()); } catch (Exception ignored) { }
            UIManager.put("Label.font",new Font("SansSerif",Font.PLAIN,14));
            UIManager.put("Button.font",new Font("SansSerif",Font.BOLD,13));
            new DesktopApp().start();
        });
    }
    private void start() {
        frame.setSize(1120,760); frame.setMinimumSize(new Dimension(860,600)); frame.setLocationRelativeTo(null);
        frame.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
        frame.addWindowListener(new WindowAdapter() { @Override public void windowClosing(WindowEvent e) {
            if (api!=null && user!=null) run(() -> api.request("POST","/api/auth/logout",null),r -> frame.dispose());
            else frame.dispose();
        }});
        JPanel glass=new JPanel(); glass.setOpaque(false); glass.addMouseListener(new MouseAdapter() {});
        glass.addKeyListener(new KeyAdapter() {}); glass.setFocusTraversalKeysEnabled(false); frame.setGlassPane(glass);
        login(); frame.setVisible(true);
    }
    private JPanel panel() { JPanel p=new JPanel(new BorderLayout(16,16)); p.setBorder(new EmptyBorder(24,24,24,24)); p.setBackground(BG); return p; }
    private JLabel heading(String text) { JLabel label=new JLabel(text); label.setFont(new Font("SansSerif",Font.BOLD,26)); label.setForeground(NAVY); return label; }
    private JButton button(String text,Runnable action) { JButton b=new JButton(text); b.addActionListener(e -> action.run()); return b; }
    private void show(JPanel content) {
        status.setBorder(new EmptyBorder(10,24,10,24)); JPanel root=new JPanel(new BorderLayout()); root.add(content); root.add(status,BorderLayout.SOUTH);
        frame.setContentPane(root); frame.revalidate(); frame.repaint();
    }
    private void login() {
        generation++; user=null; api=null; JPanel root=panel(); root.add(heading("Carona Solidária"),BorderLayout.NORTH);
        JPanel form=new JPanel(new GridLayout(0,1,8,8)); form.setBorder(new EmptyBorder(35,180,100,180)); form.setOpaque(false);
        JTextField url=new JTextField(System.getenv().getOrDefault("CARONA_API_URL","http://localhost:8079"));
        JTextField email=new JTextField(); JPasswordField password=new JPasswordField();
        form.add(new JLabel("Acesso exclusivo para RH e administradores"));
        form.add(new JLabel("Servidor")); form.add(url); form.add(new JLabel("E-mail")); form.add(email); form.add(new JLabel("Senha")); form.add(password);
        JButton enter=button("Entrar",() -> {
            if (email.getText().isBlank() || password.getPassword().length==0) { message("Preencha e-mail e senha."); return; }
            try { api=new ApiClient(url.getText()); } catch (RuntimeException ex) { message(ex.getMessage()); return; }
            Map<String,String> credentials=Map.of("email",email.getText().trim(),"password",new String(password.getPassword())); password.setText("");
            run(() -> api.request("POST","/api/auth/login",credentials),result -> {
                api.token(result.path("token").asText());
                if (!List.of("ADMIN","RH").contains(result.path("user").path("role").asText())) {
                    run(() -> api.request("POST","/api/auth/logout",null),ignored -> { login(); message("Colaboradores devem utilizar o aplicativo mobile."); }); return;
                }
                user=result.path("user"); dashboard();
            });
        });
        form.add(enter); root.add(form); show(root); frame.getRootPane().setDefaultButton(enter);
    }
    private void dashboard() {
        JPanel root=panel(); JPanel header=new JPanel(new BorderLayout()); header.setOpaque(false);
        header.add(heading("Central de mobilidade"));
        JPanel account=new JPanel(new FlowLayout(FlowLayout.RIGHT)); account.setOpaque(false);
        account.add(new JLabel(user.path("name").asText()+" · "+user.path("role").asText()));
        account.add(button("Sair",() -> run(() -> api.request("POST","/api/auth/logout",null),r -> login()))); header.add(account,BorderLayout.EAST);
        root.add(header,BorderLayout.NORTH); JTabbedPane tabs=new JTabbedPane();
        tabs.addTab("Veículos",vehicles()); tabs.addTab("Colaboradores",accounts(false)); tabs.addTab("Grupos e vagas especiais",groups());
        if (user.path("role").asText().equals("ADMIN")) tabs.addTab("Equipe de RH",accounts(true));
        root.add(tabs); show(root); frame.getRootPane().setDefaultButton(null); status.setText("Selecione uma aba e clique em Atualizar para consultar os dados.");
    }
    private static final class Grid {
        final JPanel panel=new JPanel(new BorderLayout(8,12));
        final JPanel actions=new JPanel(new FlowLayout(FlowLayout.LEFT));
        final DefaultTableModel model;
        final JTable table;
        final List<JsonNode> rows=new ArrayList<>();
        Grid(String... columns) {
            panel.setBorder(new EmptyBorder(18,18,18,18)); model=new DefaultTableModel(columns,0) { @Override public boolean isCellEditable(int r,int c) { return false; } };
            table=new JTable(model); table.setAutoCreateRowSorter(true); table.setRowHeight(32); table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
            table.getTableHeader().setReorderingAllowed(false); panel.add(actions,BorderLayout.NORTH); panel.add(new JScrollPane(table));
        }
        JsonNode selected() { int i=table.getSelectedRow(); return i<0?null:rows.get(table.convertRowIndexToModel(i)); }
        void fill(JsonNode data,java.util.function.Function<JsonNode,Object[]> row) { rows.clear(); model.setRowCount(0); data.forEach(n -> { rows.add(n); model.addRow(row.apply(n)); }); }
    }
    private JPanel vehicles() {
        Grid g=new Grid("ID","Colaborador","Placa","Modelo","Cor","Vagas","Situação","Motivo");
        Runnable refresh=() -> run(() -> api.request("GET","/api/rh/vehicles",null),data -> {
            g.fill(data,n -> new Object[]{n.path("id"),n.path("ownerName").asText(),n.path("plate").asText(),n.path("model").asText(),n.path("color").asText(),n.path("seats"),label(n.path("status").asText()),n.path("rejectionReason").asText("")});
            status.setText(g.rows.size()+" veículos · selecione um veículo pendente para analisar.");
        });
        g.actions.add(button("Atualizar",refresh));
        g.actions.add(button("Aprovar",() -> review(g,true,refresh))); g.actions.add(button("Reprovar",() -> review(g,false,refresh)));
        return g.panel;
    }
    private void review(Grid g,boolean approved,Runnable refresh) {
        JsonNode n=selected(g); if (n==null) return;
        if (!n.path("status").asText().equals("PENDING")) { message("Selecione um veículo pendente."); return; }
        String reason="";
        if (!approved) { reason=JOptionPane.showInputDialog(frame,"Motivo da reprovação (obrigatório):"); if (reason==null) return; if (reason.isBlank()) { message("Informe o motivo para o colaborador corrigir o cadastro."); return; } }
        else if (!confirm("Aprovar o veículo "+n.path("plate").asText()+"?")) return;
        Map<String,Object> body=Map.of("approved",approved,"reason",reason);
        run(() -> api.request("PATCH","/api/rh/vehicles/"+n.path("id").asLong(),body),r -> refresh.run());
    }
    private JPanel accounts(boolean rh) {
        String path=rh?"/api/admin/rh":"/api/rh/members"; Grid g=new Grid("ID","Nome","E-mail","Matrícula","Ativo","Cadastro");
        Runnable refresh=() -> run(() -> api.request("GET",path,null),data -> {
            g.fill(data,n -> new Object[]{n.path("id"),n.path("name").asText(),n.path("email").asText(),n.path("employeeId").asText(),n.path("active").asBoolean()?"Sim":"Não",n.path("registered").asBoolean()?"Concluído":"Convidado"});
            status.setText(g.rows.size()+" cadastros encontrados.");
        });
        g.actions.add(button("Atualizar",refresh)); g.actions.add(button(rh?"Cadastrar RH":"Convidar colaborador",() -> {
            Map<String,String> values=form(rh?"Cadastrar RH":"Convite · confirme o vínculo com a WEG",rh?new String[]{"Nome","E-mail","Matrícula","Senha inicial"}:new String[]{"Nome","E-mail","Matrícula"});
            if (values==null) return;
            Map<String,String> body=new HashMap<>(); body.put("name",values.get("Nome")); body.put("email",values.get("E-mail")); body.put("employeeId",values.get("Matrícula"));
            if (rh) body.put("password",values.get("Senha inicial"));
            run(() -> api.request("POST",path,body),r -> { if (!rh) invitation(r); refresh.run(); });
        }));
        g.actions.add(button("Editar / ativar",() -> {
            JsonNode n=selected(g); if (n==null) return;
            JTextField name=new JTextField(n.path("name").asText()); JCheckBox active=new JCheckBox("Conta ativa",n.path("active").asBoolean());
            JPanel form=new JPanel(new GridLayout(0,1,8,8)); form.add(new JLabel("Nome")); form.add(name); form.add(active);
            form.add(new JLabel("Desativar encerra as caronas e revoga as sessões."));
            if (JOptionPane.showConfirmDialog(frame,form,"Gerenciar cadastro",JOptionPane.OK_CANCEL_OPTION)!=JOptionPane.OK_OPTION) return;
            if (name.getText().isBlank()) { message("Informe o nome."); return; }
            Map<String,Object> body=Map.of("name",name.getText().trim(),"active",active.isSelected());
            run(() -> api.request("PATCH",path+"/"+n.path("id").asLong(),body),r -> refresh.run());
        }));
        if (!rh) g.actions.add(button("Renovar convite",() -> {
            JsonNode n=selected(g); if (n==null || !confirm("Invalidar o convite anterior e gerar outro?")) return;
            run(() -> api.request("POST",path+"/"+n.path("id").asLong()+"/invitation",null),this::invitation);
        }));
        return g.panel;
    }
    private JPanel groups() {
        Grid g=new Grid("Grupo","Motorista","Origem","Destino","Horário","Vagas livres","Ativa","Elegível a vaga especial");
        g.actions.add(button("Atualizar",() -> run(() -> api.request("GET","/api/rh/groups",null),data -> {
            g.fill(data,n -> new Object[]{n.path("id"),n.path("driverName").asText(),n.path("origin").asText(),n.path("destination").asText(),n.path("departureTime").asText(),n.path("availableSeats"),n.path("active").asBoolean()?"Sim":"Não",n.path("specialParkingEligible").asBoolean()?"Sim":"Não"});
            status.setText(g.rows.size()+" grupos · parentes ocupam assentos, mas não contam para a elegibilidade.");
        })));
        g.actions.add(button("Participantes",() -> {
            JsonNode n=selected(g); if (n==null) return;
            run(() -> api.request("GET","/api/rides/"+n.path("id").asLong(),null),data -> {
                StringBuilder text=new StringBuilder("Placa: "+data.path("plate").asText()+"\nMotorista: "+data.path("driverWhatsapp").asText()+"\n\n");
                data.path("participants").forEach(p -> text.append(p.path("passengerName").asText()).append(" · ").append(label(p.path("status").asText())).append(p.path("relative").asBoolean()?" · parente":"").append("\n"));
                JTextArea area=new JTextArea(text.toString(),15,55); area.setEditable(false); JOptionPane.showMessageDialog(frame,new JScrollPane(area),"Participantes",JOptionPane.INFORMATION_MESSAGE);
            });
        })); return g.panel;
    }
    private Map<String,String> form(String title,String[] fields) {
        JPanel form=new JPanel(new GridLayout(0,1,6,6)); Map<String,JTextField> inputs=new LinkedHashMap<>();
        for (String field:fields) { JTextField input=field.startsWith("Senha")?new JPasswordField(30):new JTextField(30); inputs.put(field,input); form.add(new JLabel(field)); form.add(input); }
        if (JOptionPane.showConfirmDialog(frame,form,title,JOptionPane.OK_CANCEL_OPTION)!=JOptionPane.OK_OPTION) return null;
        Map<String,String> values=new HashMap<>();
        for (var entry:inputs.entrySet()) {
            String value=entry.getValue() instanceof JPasswordField p?new String(p.getPassword()):entry.getValue().getText().trim();
            if (value.isBlank()) { message("Preencha todos os campos."); return null; } values.put(entry.getKey(),value);
        }
        return values;
    }
    private void invitation(JsonNode data) {
        JTextArea area=new JTextArea("Entregue este código ao colaborador após verificar sua identidade.\nO código é exibido somente agora e será consumido no primeiro acesso.\n\n"+data.path("invitationCode").asText(),6,58);
        area.setLineWrap(true); area.setWrapStyleWord(true); area.setEditable(false);
        JOptionPane.showMessageDialog(frame,new JScrollPane(area),"Convite de acesso",JOptionPane.INFORMATION_MESSAGE);
    }
    private JsonNode selected(Grid g) { JsonNode n=g.selected(); if (n==null) message("Selecione um registro na tabela."); return n; }
    private boolean confirm(String text) { return JOptionPane.showConfirmDialog(frame,text,"Confirmar",JOptionPane.YES_NO_OPTION)==JOptionPane.YES_OPTION; }
    private void message(String text) { JOptionPane.showMessageDialog(frame,text,"Carona Solidária",JOptionPane.INFORMATION_MESSAGE); }
    private static String label(String value) { return switch(value) { case "PENDING" -> "Pendente"; case "APPROVED","ACCEPTED" -> "Aprovado"; case "REJECTED" -> "Recusado"; case "LEFT" -> "Saiu"; case "REMOVED" -> "Removido"; default -> value; }; }
    private void run(Callable<JsonNode> task,Consumer<JsonNode> done) {
        int current=generation; status.setText("Carregando…"); frame.getGlassPane().setVisible(true); frame.getGlassPane().requestFocusInWindow();
        new SwingWorker<JsonNode,Void>() {
            @Override protected JsonNode doInBackground() throws Exception { return task.call(); }
            @Override protected void done() {
                frame.getGlassPane().setVisible(false); if (current!=generation) return;
                try { JsonNode result=get(); status.setText("Operação concluída."); done.accept(result); }
                catch (Exception ex) {
                    Throwable cause=ex.getCause()==null?ex:ex.getCause(); status.setText("Não foi possível concluir a operação.");
                    if (cause instanceof ApiClient.ApiError error && error.status==401) login();
                    message(cause instanceof ApiClient.ApiError?cause.getMessage():"Falha de conexão. Confira o servidor e tente novamente.");
                }
            }
        }.execute();
    }
}
