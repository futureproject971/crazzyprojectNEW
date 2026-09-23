#include "MainWindow.h"
#include "core/Logger.h"
#include "platform/ProcessLauncher.h"
#include "platform/Utf.h"
#include "imgui.h"
#include "imgui_impl_dx11.h"
#include "imgui_impl_win32.h"
#include <algorithm>
#include <array>
#include <cstring>
#include <filesystem>
#include <windowsx.h>

extern IMGUI_IMPL_API LRESULT ImGui_ImplWin32_WndProcHandler(HWND, UINT, WPARAM, LPARAM);

namespace crazzy {
namespace {
constexpr ImVec4 BLUE(0.05f, 0.28f, 1.00f, 1.00f);
constexpr ImVec4 BLUE_HOVER(0.18f, 0.50f, 1.00f, 1.00f);
constexpr ImVec4 BLUE_SOFT(0.06f, 0.16f, 0.38f, 1.00f);
constexpr ImVec4 PANEL(0.025f, 0.040f, 0.085f, 1.00f);
constexpr ImVec4 PANEL2(0.040f, 0.060f, 0.115f, 1.00f);
constexpr ImVec4 BORDER(0.12f, 0.36f, 0.98f, 0.86f);
constexpr ImVec4 MUTED(0.52f, 0.61f, 0.78f, 1.00f);
constexpr ImVec4 GREEN(0.18f, 0.88f, 0.60f, 1.00f);
constexpr ImVec4 YELLOW(1.00f, 0.70f, 0.22f, 1.00f);
constexpr ImVec4 RED(1.00f, 0.33f, 0.33f, 1.00f);
constexpr float TOPBAR_H = 58.0f;
constexpr float SIDEBAR_W = 220.0f;
constexpr float OUTER = 18.0f;

std::string U(const std::wstring& s) { return utf::ToUtf8(s); }

std::string MaskKey(const std::wstring& key) {
    auto k = U(key);
    if (k.size() <= 8) return "********";
    return k.substr(0, 4) + "-****-****-" + k.substr(k.size() - 4);
}

const char* TaskText(update::TaskState s) {
    switch (s) {
        case update::TaskState::Downloading: return "BAIXANDO";
        case update::TaskState::Verifying: return "VALIDANDO";
        case update::TaskState::Installing: return "INSTALANDO";
        case update::TaskState::Completed: return "PRONTO";
        case update::TaskState::Failed: return "ERRO";
        case update::TaskState::Canceled: return "CANCELADO";
        default: return "";
    }
}

bool CircleButton(const char* id, ImU32 fill, const char* tip) {
    const ImVec2 p = ImGui::GetCursorScreenPos();
    ImGui::InvisibleButton(id, ImVec2(14, 14));
    auto* d = ImGui::GetWindowDrawList();
    d->AddCircleFilled(ImVec2(p.x + 7, p.y + 7), 7, fill);
    if (ImGui::IsItemHovered()) {
        d->AddCircle(ImVec2(p.x + 7, p.y + 7), 9, IM_COL32(255,255,255,65), 24, 1.2f);
        ImGui::SetTooltip("%s", tip);
    }
    return ImGui::IsItemClicked();
}

ImVec4 AccentFor(const Product& p) {
    const auto g = U(p.game);
    if (g == "VALORANT") return ImVec4(0.92f, 0.20f, 0.31f, 1.0f);
    if (g == "RUST") return ImVec4(0.91f, 0.42f, 0.18f, 1.0f);
    if (g == "CS2") return ImVec4(0.93f, 0.66f, 0.24f, 1.0f);
    return BLUE_HOVER;
}
}

MainWindow::MainWindow(HINSTANCE instance, std::unique_ptr<IApiClient> api)
    : instance_(instance), api_(std::move(api)) {}

MainWindow::~MainWindow() {
    for (auto& [_, task] : tasks_) {
        if (task && task->worker.joinable()) task->worker.request_stop();
    }
}

int MainWindow::Run(int showCommand) {
    ImGui_ImplWin32_EnableDpiAwareness();
    WNDCLASSEXW wc{sizeof(wc), CS_CLASSDC, StaticWndProc, 0L, 0L, instance_, nullptr, nullptr, nullptr, nullptr, L"CrazzyMultiloaderWindow", nullptr};
    RegisterClassExW(&wc);

    const DWORD style = WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX;
    hwnd_ = CreateWindowExW(WS_EX_APPWINDOW, wc.lpszClassName, L"CRAZZY MULTILOADER", style,
                            120, 90, 1280, 780, nullptr, nullptr, instance_, this);
    if (!hwnd_) return 1;

    if (!CreateDeviceD3D(hwnd_)) {
        CleanupDeviceD3D();
        UnregisterClassW(wc.lpszClassName, instance_);
        return 1;
    }

    ShowWindow(hwnd_, showCommand);
    UpdateWindow(hwnd_);

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;
    io.IniFilename = nullptr;
    io.Fonts->AddFontFromFileTTF("C:\\Windows\\Fonts\\segoeui.ttf", 18.0f, nullptr, io.Fonts->GetGlyphRangesDefault());

    ImGui::StyleColorsDark();
    ApplyStyle();
    ImGui_ImplWin32_Init(hwnd_);
    ImGui_ImplDX11_Init(device_, context_);
    RefreshProducts();

    bool done = false;
    while (!done) {
        MSG msg;
        while (PeekMessage(&msg, nullptr, 0U, 0U, PM_REMOVE)) {
            TranslateMessage(&msg);
            DispatchMessage(&msg);
            if (msg.message == WM_QUIT) done = true;
        }
        if (done) break;

        ImGui_ImplDX11_NewFrame();
        ImGui_ImplWin32_NewFrame();
        ImGui::NewFrame();
        DrawUi();
        ImGui::Render();

        const float clear[4] = {0.005f, 0.010f, 0.025f, 1.0f};
        context_->OMSetRenderTargets(1, &renderTarget_, nullptr);
        context_->ClearRenderTargetView(renderTarget_, clear);
        ImGui_ImplDX11_RenderDrawData(ImGui::GetDrawData());
        swapChain_->Present(1, 0);
    }

    ImGui_ImplDX11_Shutdown();
    ImGui_ImplWin32_Shutdown();
    ImGui::DestroyContext();
    CleanupDeviceD3D();
    DestroyWindow(hwnd_);
    UnregisterClassW(wc.lpszClassName, instance_);
    return 0;
}

LRESULT CALLBACK MainWindow::StaticWndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    MainWindow* self = reinterpret_cast<MainWindow*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    if (msg == WM_NCCREATE) {
        auto* cs = reinterpret_cast<CREATESTRUCTW*>(lp);
        self = static_cast<MainWindow*>(cs->lpCreateParams);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
    }
    return self ? self->WndProc(hwnd, msg, wp, lp) : DefWindowProcW(hwnd, msg, wp, lp);
}

LRESULT MainWindow::WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    if (ImGui_ImplWin32_WndProcHandler(hwnd, msg, wp, lp)) return true;
    switch (msg) {
        case WM_NCCALCSIZE: return 0;
        case WM_NCHITTEST: {
            const LRESULT hit = DefWindowProcW(hwnd, msg, wp, lp);
            if (hit != HTCLIENT) return hit;
            if (!IsZoomed(hwnd)) {
                constexpr LONG b = 8;
                RECT rc{}; GetWindowRect(hwnd, &rc);
                POINT pt{GET_X_LPARAM(lp), GET_Y_LPARAM(lp)};
                const bool l = pt.x >= rc.left && pt.x < rc.left + b;
                const bool r = pt.x <= rc.right && pt.x > rc.right - b;
                const bool t = pt.y >= rc.top && pt.y < rc.top + b;
                const bool bo = pt.y <= rc.bottom && pt.y > rc.bottom - b;
                if (t && l) return HTTOPLEFT;
                if (t && r) return HTTOPRIGHT;
                if (bo && l) return HTBOTTOMLEFT;
                if (bo && r) return HTBOTTOMRIGHT;
                if (l) return HTLEFT;
                if (r) return HTRIGHT;
                if (t) return HTTOP;
                if (bo) return HTBOTTOM;
            }
            return HTCLIENT;
        }
        case WM_SIZE:
            maximized_ = IsZoomed(hwnd_);
            if (device_ && wp != SIZE_MINIMIZED) {
                CleanupRenderTarget();
                swapChain_->ResizeBuffers(0, LOWORD(lp), HIWORD(lp), DXGI_FORMAT_UNKNOWN, 0);
                CreateRenderTarget();
            }
            return 0;
        case WM_SYSCOMMAND:
            if ((wp & 0xfff0) == SC_KEYMENU) return 0;
            break;
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

bool MainWindow::CreateDeviceD3D(HWND hwnd) {
    DXGI_SWAP_CHAIN_DESC sd{};
    sd.BufferCount = 2;
    sd.BufferDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    sd.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    sd.OutputWindow = hwnd;
    sd.SampleDesc.Count = 1;
    sd.Windowed = TRUE;
    sd.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;

    D3D_FEATURE_LEVEL fl;
    const D3D_FEATURE_LEVEL levels[2] = {D3D_FEATURE_LEVEL_11_0, D3D_FEATURE_LEVEL_10_0};
    HRESULT hr = D3D11CreateDeviceAndSwapChain(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, 0, levels, 2,
                                               D3D11_SDK_VERSION, &sd, &swapChain_, &device_, &fl, &context_);
    if (hr == DXGI_ERROR_UNSUPPORTED)
        hr = D3D11CreateDeviceAndSwapChain(nullptr, D3D_DRIVER_TYPE_WARP, nullptr, 0, levels, 2,
                                           D3D11_SDK_VERSION, &sd, &swapChain_, &device_, &fl, &context_);
    if (FAILED(hr)) return false;
    CreateRenderTarget();
    return true;
}

void MainWindow::CleanupDeviceD3D() {
    CleanupRenderTarget();
    if (swapChain_) { swapChain_->Release(); swapChain_ = nullptr; }
    if (context_) { context_->Release(); context_ = nullptr; }
    if (device_) { device_->Release(); device_ = nullptr; }
}

void MainWindow::CreateRenderTarget() {
    ID3D11Texture2D* back = nullptr;
    swapChain_->GetBuffer(0, IID_PPV_ARGS(&back));
    if (back) {
        device_->CreateRenderTargetView(back, nullptr, &renderTarget_);
        back->Release();
    }
}

void MainWindow::CleanupRenderTarget() {
    if (renderTarget_) { renderTarget_->Release(); renderTarget_ = nullptr; }
}

void MainWindow::ApplyStyle() {
    auto& s = ImGui::GetStyle();
    s.WindowRounding = 20.0f;
    s.ChildRounding = 16.0f;
    s.FrameRounding = 10.0f;
    s.PopupRounding = 16.0f;
    s.ScrollbarRounding = 18.0f;
    s.WindowPadding = {18,18};
    s.FramePadding = {12,10};
    s.ItemSpacing = {10,10};
    s.WindowBorderSize = 1.0f;
    s.ChildBorderSize = 1.0f;
    s.FrameBorderSize = 1.0f;
    s.PopupBorderSize = 1.0f;

    auto* c = s.Colors;
    c[ImGuiCol_WindowBg] = ImVec4(0.010f,0.018f,0.042f,1.0f);
    c[ImGuiCol_ChildBg] = PANEL;
    c[ImGuiCol_PopupBg] = ImVec4(0.025f,0.042f,0.095f,0.99f);
    c[ImGuiCol_Border] = BORDER;
    c[ImGuiCol_FrameBg] = PANEL2;
    c[ImGuiCol_FrameBgHovered] = ImVec4(0.07f,0.13f,0.25f,1.0f);
    c[ImGuiCol_FrameBgActive] = ImVec4(0.08f,0.17f,0.32f,1.0f);
    c[ImGuiCol_Button] = BLUE;
    c[ImGuiCol_ButtonHovered] = BLUE_HOVER;
    c[ImGuiCol_ButtonActive] = ImVec4(0.03f,0.21f,0.72f,1.0f);
    c[ImGuiCol_Header] = BLUE_SOFT;
    c[ImGuiCol_HeaderHovered] = ImVec4(0.07f,0.23f,0.62f,1.0f);
    c[ImGuiCol_HeaderActive] = BLUE;
    c[ImGuiCol_TextDisabled] = MUTED;
    c[ImGuiCol_Separator] = ImVec4(0.14f,0.27f,0.56f,0.80f);
    c[ImGuiCol_ScrollbarBg] = ImVec4(0.01f,0.02f,0.04f,0.80f);
    c[ImGuiCol_ScrollbarGrab] = BLUE_SOFT;
    c[ImGuiCol_ScrollbarGrabHovered] = BLUE_HOVER;
    c[ImGuiCol_ScrollbarGrabActive] = BLUE;
}

void MainWindow::RefreshProducts() {
    try {
        catalog_.Replace(api_->FetchMyProducts());
        Logger::Info(L"Catalog synchronized from " + api_->Name());
    } catch (...) {
        ShowInfoModal(L"Falha de sincronizacao", L"Nao foi possivel carregar seus produtos agora.");
    }
}

MainWindow::RuntimeTask* MainWindow::TaskFor(const std::wstring& id) {
    auto it = tasks_.find(id);
    return it == tasks_.end() ? nullptr : it->second.get();
}

void MainWindow::DrawUi() {
    ImGuiViewport* vp = ImGui::GetMainViewport();
    ImGui::SetNextWindowPos(vp->WorkPos);
    ImGui::SetNextWindowSize(vp->WorkSize);
    ImGui::Begin("##root", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoSavedSettings);
    DrawBackgroundDecor();
    DrawTitleBar();
    if (loggedIn_) DrawLibrary(); else DrawLogin();
    DrawModals();
    ImGui::End();
}

void MainWindow::DrawBackgroundDecor() {
    auto* d = ImGui::GetWindowDrawList();
    const ImVec2 p = ImGui::GetWindowPos();
    const ImVec2 s = ImGui::GetWindowSize();
    const ImVec2 m(p.x+s.x, p.y+s.y);
    d->AddRectFilledMultiColor(p, m, IM_COL32(2,7,22,255), IM_COL32(5,13,38,255), IM_COL32(2,8,24,255), IM_COL32(4,16,45,255));
    d->AddCircleFilled(ImVec2(p.x+270,p.y+180), 230, IM_COL32(8,70,255,20), 80);
    d->AddCircleFilled(ImVec2(m.x-180,p.y+190), 180, IM_COL32(12,68,210,16), 80);
    d->AddRect(p, m, IM_COL32(28,106,255,120), 22.0f, 0, 1.2f);
}

void MainWindow::DrawTitleBar() {
    ImGui::SetCursorPos(ImVec2(OUTER,10));
    ImGui::BeginChild("topbar", ImVec2(0,TOPBAR_H-8), false, ImGuiWindowFlags_NoScrollbar);

    bool dots = false;
    if (CircleButton("##close", IM_COL32(255,95,86,255), "Fechar")) PostMessageW(hwnd_, WM_CLOSE, 0, 0);
    dots |= ImGui::IsItemHovered();
    ImGui::SameLine(0,8);
    if (CircleButton("##min", IM_COL32(255,189,46,255), "Minimizar")) ShowWindow(hwnd_, SW_MINIMIZE);
    dots |= ImGui::IsItemHovered();
    ImGui::SameLine(0,8);
    if (CircleButton("##max", IM_COL32(39,201,63,255), maximized_ ? "Restaurar" : "Maximizar")) ToggleMaximize();
    dots |= ImGui::IsItemHovered();

    ImGui::SetCursorPos(ImVec2(90,10));
    ImGui::TextColored(BLUE_HOVER, "CRAZZY"); ImGui::SameLine(0,5); ImGui::Text("PROJECT");
    ImGui::SameLine(0,10); ImGui::TextDisabled("MULTILOADER v0.5");

    if (loggedIn_) {
        ImGui::SetCursorPos(ImVec2(ImGui::GetWindowWidth()-260,6));
        if (ImGui::Button("ATUALIZAR", ImVec2(118,30))) RefreshProducts();
        ImGui::SameLine();
        if (ImGui::Button("SAIR", ImVec2(92,30))) loggedIn_ = false;
    }

    const bool hover = ImGui::IsWindowHovered(ImGuiHoveredFlags_RootAndChildWindows);
    if (!dots && hover && ImGui::IsMouseDragging(ImGuiMouseButton_Left,0.0f)) RequestWindowMove();
    if (!dots && hover && ImGui::IsMouseDoubleClicked(ImGuiMouseButton_Left)) ToggleMaximize();
    ImGui::EndChild();
}

void MainWindow::DrawLogin() {
    const float w = 470.0f, h = 390.0f;
    ImGui::SetCursorPos(ImVec2((ImGui::GetWindowWidth()-w)*0.5f, TOPBAR_H + 90.0f));
    ImGui::BeginChild("login", ImVec2(w,h), true, ImGuiWindowFlags_NoScrollbar);

    auto* d = ImGui::GetWindowDrawList();
    const ImVec2 p = ImGui::GetWindowPos(), s = ImGui::GetWindowSize();
    d->AddRectFilledMultiColor(p, ImVec2(p.x+s.x,p.y+115), IM_COL32(8,32,96,160), IM_COL32(4,14,42,120), IM_COL32(8,32,96,25), IM_COL32(4,14,42,20));

    ImGui::Dummy(ImVec2(0,18));
    const char* brand = "CRAZZY PROJECT";
    ImGui::SetCursorPosX((ImGui::GetWindowWidth()-ImGui::CalcTextSize(brand).x)*0.5f);
    ImGui::TextColored(BLUE_HOVER, "%s", brand);

    ImGui::Dummy(ImVec2(0,12));
    ImGui::SetWindowFontScale(1.45f);
    const char* title = "CRAZZY MULTILOADER";
    ImGui::SetCursorPosX((ImGui::GetWindowWidth()-ImGui::CalcTextSize(title).x)*0.5f);
    ImGui::TextUnformatted(title);
    ImGui::SetWindowFontScale(1.0f);

    ImGui::Dummy(ImVec2(0,6));
    ImGui::TextDisabled("Login, produtos adquiridos e keys. So o essencial.");
    ImGui::Dummy(ImVec2(0,28));

    if (ImGui::Button("ENTRAR COM DISCORD", ImVec2(-1,50))) {
        loggedIn_ = true;
        RefreshProducts();
    }

    ImGui::Dummy(ImVec2(0,16));
    ImGui::Separator();
    ImGui::Dummy(ImVec2(0,14));
    ImGui::TextDisabled("LOGIN SEGURO");
    ImGui::TextWrapped("A versao final usa o mesmo Discord OAuth do site. A senha do Discord nunca fica dentro do Multiloader.");
    ImGui::Dummy(ImVec2(0,8));
    ImGui::TextColored(GREEN, "Conta -> Produtos -> Keys -> Iniciar");
    ImGui::EndChild();
}

void MainWindow::DrawSidebar() {
    ImGui::BeginChild("sidebar", ImVec2(SIDEBAR_W,0), true, ImGuiWindowFlags_NoScrollbar);
    ImGui::TextColored(BLUE_HOVER,"CRAZZY"); ImGui::SameLine(0,4); ImGui::Text("PROJECT");
    ImGui::TextDisabled("MULTILOADER");
    ImGui::Dummy(ImVec2(0,12));
    ImGui::Separator();
    ImGui::Dummy(ImVec2(0,10));
    ImGui::PushStyleColor(ImGuiCol_Header, ImVec4(0.05f,0.24f,0.76f,1.0f));
    ImGui::Selectable("MEUS PRODUTOS", true, 0, ImVec2(-1,42));
    ImGui::PopStyleColor();
    ImGui::Dummy(ImVec2(0,10));
    ImGui::TextDisabled("CONTA");
    ImGui::TextWrapped("Discord conectado");
    ImGui::TextColored(GREEN,"ATIVA");
    ImGui::EndChild();
}

void MainWindow::DrawLibrary() {
    ImGui::SetCursorPos(ImVec2(OUTER,TOPBAR_H+18));
    ImGui::BeginChild("body", ImVec2(0,-OUTER), false);
    DrawSidebar();
    ImGui::SameLine(0,14);

    ImGui::BeginChild("library", ImVec2(0,0), false);
    ImGui::TextColored(BLUE_HOVER,"MEUS PRODUTOS");
    ImGui::SetWindowFontScale(1.35f);
    ImGui::TextUnformatted("PRODUTOS ADQUIRIDOS");
    ImGui::SetWindowFontScale(1.0f);
    ImGui::TextDisabled("Somente o que pertence a sua conta.");
    ImGui::Separator();
    ImGui::Dummy(ImVec2(0,8));

    const float gap = 14.0f;
    const float cardW = (ImGui::GetContentRegionAvail().x-gap)*0.5f;
    int i = 0;
    for (auto& p : catalog_.Items()) {
        if (i%2) ImGui::SameLine(0,gap);
        ImGui::BeginChild(("card##"+U(p.id)).c_str(), ImVec2(cardW,310), true, ImGuiWindowFlags_NoScrollbar);
        DrawProductCard(p);
        ImGui::EndChild();
        ++i;
    }
    if (catalog_.Items().empty()) ImGui::TextDisabled("Nenhum produto adquirido nesta conta.");

    ImGui::EndChild();
    ImGui::EndChild();
}

void MainWindow::DrawProductCard(Product& p) {
    const ImVec4 accent = AccentFor(p);
    auto* d = ImGui::GetWindowDrawList();
    const ImVec2 wp = ImGui::GetWindowPos(), ws = ImGui::GetWindowSize();
    d->AddRectFilledMultiColor(wp, ImVec2(wp.x+ws.x,wp.y+76),
        ImGui::GetColorU32(ImVec4(accent.x,accent.y,accent.z,0.28f)),
        IM_COL32(10,16,34,110), IM_COL32(8,12,26,0), IM_COL32(8,12,26,0));

    ImGui::TextColored(accent,"%s",U(p.game).c_str());
    ImGui::Text("%s",U(p.name).c_str());
    ImGui::TextDisabled("%s",U(p.description).c_str());
    ImGui::Dummy(ImVec2(0,6));

    ImGui::Columns(2,nullptr,false);
    ImGui::TextDisabled("PLANO"); ImGui::Text("%s",U(p.plan).c_str());
    ImGui::NextColumn();
    ImGui::TextDisabled("EXPIRA"); ImGui::Text("%s",U(p.expiresAt).c_str());
    ImGui::Columns(1);

    ImGui::Separator();
    ImGui::TextDisabled("SUA KEY");
    const bool reveal = revealKeys_[p.id];
    std::string key = reveal ? U(p.licenseKey) : MaskKey(p.licenseKey);
    std::array<char,512> buf{};
    const auto n = (std::min)(key.size(),buf.size()-1);
    std::memcpy(buf.data(),key.data(),n);
    ImGui::PushItemWidth(-1);
    ImGui::InputText(("##key"+U(p.id)).c_str(),buf.data(),buf.size(),ImGuiInputTextFlags_ReadOnly);
    ImGui::PopItemWidth();

    const float half = (ImGui::GetContentRegionAvail().x-8.0f)*0.5f;
    if (ImGui::Button(((reveal?"OCULTAR##":"MOSTRAR##")+U(p.id)).c_str(),ImVec2(half,36))) revealKeys_[p.id]=!reveal;
    ImGui::SameLine();
    if (ImGui::Button(("COPIAR KEY##"+U(p.id)).c_str(),ImVec2(-1,36))) ImGui::SetClipboardText(U(p.licenseKey).c_str());

    RuntimeTask* t = TaskFor(p.id);
    if (t && t->status.state != update::TaskState::Idle) {
        const auto state = t->status.state.load();
        ImGui::TextColored(state==update::TaskState::Failed?RED:BLUE_HOVER,"%s",TaskText(state));
        if (state==update::TaskState::Downloading) {
            const auto total=t->status.total.load(), done=t->status.received.load();
            const float f=total?static_cast<float>(done)/static_cast<float>(total):0.0f;
            ImGui::ProgressBar(f,ImVec2(-1,16));
        }
        if (state==update::TaskState::Completed && t->autoLaunch && !t->launchIssued) {
            t->launchIssued=true;
            p.installedVersion=t->targetVersion;
            p.updateRequired=false;
            LaunchProduct(p);
        }
    } else if (p.maintenance) ImGui::TextColored(YELLOW,"MANUTENCAO");
    else if (p.revoked) ImGui::TextColored(RED,"LICENCA INDISPONIVEL");
    else if (p.expired) ImGui::TextColored(YELLOW,"EXPIRADO");
    else if (p.updateRequired) ImGui::TextColored(BLUE_HOVER,"NOVA VERSAO: %s",U(p.latestVersion).c_str());
    else ImGui::TextColored(GREEN,"ATUALIZADO");

    ImGui::SetCursorPosY(ImGui::GetWindowHeight()-52);
    const bool blocked = p.maintenance || p.revoked || p.expired ||
        (t && t->status.state!=update::TaskState::Idle &&
         t->status.state!=update::TaskState::Completed &&
         t->status.state!=update::TaskState::Failed);
    if (blocked) ImGui::BeginDisabled();
    if (p.updateRequired) {
        if (ImGui::Button(("ATUALIZAR E INICIAR##"+U(p.id)).c_str(),ImVec2(-1,38))) pendingUpdateProduct_=&p;
    } else {
        if (ImGui::Button(("INICIAR##"+U(p.id)).c_str(),ImVec2(-1,38))) LaunchProduct(p);
    }
    if (blocked) ImGui::EndDisabled();
}

void MainWindow::DrawModals() {
    if (pendingUpdateProduct_) ImGui::OpenPopup("ATUALIZACAO DISPONIVEL");
    if (ImGui::BeginPopupModal("ATUALIZACAO DISPONIVEL",nullptr,ImGuiWindowFlags_AlwaysAutoResize)) {
        auto* p=pendingUpdateProduct_;
        if (p) {
            ImGui::TextColored(BLUE_HOVER,"%s",U(p->name).c_str());
            ImGui::Text("%s -> %s",U(p->installedVersion).c_str(),U(p->latestVersion).c_str());
            ImGui::Spacing();
            ImGui::TextWrapped("Baixar a versao nova, validar e abrir automaticamente?");
            ImGui::Spacing();
            if (ImGui::Button("ATUALIZAR E ABRIR",ImVec2(210,40))) {
                Product copy=*p;
                pendingUpdateProduct_=nullptr;
                ImGui::CloseCurrentPopup();
                BeginUpdate(std::move(copy),true);
            }
            ImGui::SameLine();
            if (ImGui::Button("CANCELAR",ImVec2(110,40))) {
                pendingUpdateProduct_=nullptr;
                ImGui::CloseCurrentPopup();
            }
        }
        ImGui::EndPopup();
    }

    if (infoModal_.open) ImGui::OpenPopup(infoModal_.popupId.c_str());
    if (ImGui::BeginPopupModal(infoModal_.popupId.c_str(),nullptr,ImGuiWindowFlags_AlwaysAutoResize)) {
        infoModal_.open=false;
        ImGui::TextColored(BLUE_HOVER,"%s",U(infoModal_.title).c_str());
        ImGui::Spacing();
        ImGui::TextWrapped("%s",U(infoModal_.message).c_str());
        ImGui::Spacing();
        if (ImGui::Button(U(infoModal_.primaryLabel).c_str(),ImVec2(120,40))) ImGui::CloseCurrentPopup();
        ImGui::EndPopup();
    }
}

void MainWindow::BeginUpdate(Product product, bool autoLaunch) {
    try {
        DownloadTicket ticket=api_->RequestDownload(product.id);
        auto task=std::make_unique<RuntimeTask>();
        task->autoLaunch=autoLaunch;
        task->targetVersion=ticket.version;
        RuntimeTask* raw=task.get();
        tasks_[product.id]=std::move(task);
        raw->worker=std::jthread([product=std::move(product),ticket=std::move(ticket),raw](std::stop_token st) {
            update::ProductUpdater::Install(product,ticket,raw->status,st);
        });
    } catch (...) {
        ShowInfoModal(L"Release indisponivel",L"Nao foi possivel obter a release autorizada deste produto.");
    }
}

void MainWindow::LaunchProduct(const Product& p) {
    if (p.maintenance || p.expired || p.revoked) return;
    if (!std::filesystem::exists(p.executablePath)) {
        ShowInfoModal(L"Produto nao instalado",L"Atualize/instale o produto antes de iniciar.");
        return;
    }
    if (!platform::LaunchElevated(p.executablePath)) {
        ShowInfoModal(L"Falha ao iniciar",L"Nao foi possivel iniciar o produto como Administrador.");
        return;
    }
    Logger::Info(L"Product launched: "+p.id);
}

void MainWindow::ShowInfoModal(const std::wstring& title,const std::wstring& message,const std::wstring& buttonLabel) {
    infoModal_.title=title;
    infoModal_.message=message;
    infoModal_.primaryLabel=buttonLabel;
    infoModal_.open=true;
}

void MainWindow::RequestWindowMove() {
    ReleaseCapture();
    SendMessageW(hwnd_,WM_NCLBUTTONDOWN,HTCAPTION,0);
}

void MainWindow::ToggleMaximize() {
    if (IsZoomed(hwnd_)) ShowWindow(hwnd_,SW_RESTORE);
    else ShowWindow(hwnd_,SW_MAXIMIZE);
    maximized_=IsZoomed(hwnd_);
}
}
