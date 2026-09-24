#define NOMINMAX
#include <windows.h>
#include <shellapi.h>
#include <string>
#include <vector>
#include <iostream>
#include <algorithm>
#include <conio.h>

struct Product {
    std::wstring game;
    std::wstring name;
    std::wstring plan;
    std::wstring expires;
    std::wstring key;
    std::wstring exePath;
    bool maintenance{};
};

static HANDLE gOut = GetStdHandle(STD_OUTPUT_HANDLE);

void Color(WORD c) { SetConsoleTextAttribute(gOut, c); }
void Normal() { Color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE); }
void Blue() { Color(FOREGROUND_BLUE | FOREGROUND_GREEN | FOREGROUND_INTENSITY); }
void White() { Color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE | FOREGROUND_INTENSITY); }
void Gray() { Color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE); }
void Green() { Color(FOREGROUND_GREEN | FOREGROUND_INTENSITY); }
void Yellow() { Color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_INTENSITY); }
void Red() { Color(FOREGROUND_RED | FOREGROUND_INTENSITY); }

void Clear() {
    CONSOLE_SCREEN_BUFFER_INFO csbi{};
    GetConsoleScreenBufferInfo(gOut, &csbi);
    DWORD cells = csbi.dwSize.X * csbi.dwSize.Y;
    DWORD written = 0;
    COORD home{0,0};
    FillConsoleOutputCharacterW(gOut, L' ', cells, home, &written);
    FillConsoleOutputAttribute(gOut, csbi.wAttributes, cells, home, &written);
    SetConsoleCursorPosition(gOut, home);
}

void HideCursor() {
    CONSOLE_CURSOR_INFO ci{};
    ci.dwSize = 1;
    ci.bVisible = FALSE;
    SetConsoleCursorInfo(gOut, &ci);
}

std::wstring Mask(const std::wstring& k) {
    if (k.size() < 8) return L"********";
    return k.substr(0, 4) + L"-****-****-" + k.substr(k.size() - 4);
}

bool CopyClipboard(const std::wstring& text) {
    if (!OpenClipboard(nullptr)) return false;
    EmptyClipboard();
    const size_t bytes = (text.size() + 1) * sizeof(wchar_t);
    HGLOBAL mem = GlobalAlloc(GMEM_MOVEABLE, bytes);
    if (!mem) { CloseClipboard(); return false; }
    void* ptr = GlobalLock(mem);
    memcpy(ptr, text.c_str(), bytes);
    GlobalUnlock(mem);
    if (!SetClipboardData(CF_UNICODETEXT, mem)) {
        GlobalFree(mem);
        CloseClipboard();
        return false;
    }
    CloseClipboard();
    return true;
}

void DrawLine(int width = 76) {
    Blue();
    std::wcout << L"+" << std::wstring(width - 2, L'-') << L"+\n";
    Normal();
}

void DrawHeader() {
    DrawLine();
    Blue(); std::wcout << L"|  CRAZZY "; White(); std::wcout << L"PROJECT";
    Gray(); std::wcout << L"  |  MULTILOADER CMD";
    std::wcout << std::wstring(76 - 2 - 9 - 7 - 21, L' ') << L"|\n";
    DrawLine();
}

void Center(const std::wstring& text, int width = 74) {
    int pad = std::max(0, (width - (int)text.size()) / 2);
    std::wcout << L"|" << std::wstring(pad, L' ') << text;
    int rest = width - pad - (int)text.size();
    std::wcout << std::wstring(std::max(0,rest), L' ') << L"|\n";
}

void DrawLogin() {
    Clear();
    DrawHeader();
    std::wcout << L"|                                                                          |\n";
    Blue(); Center(L"CRAZZY MULTILOADER"); Normal();
    Center(L"Login simples. Produtos. Keys. Iniciar.");
    std::wcout << L"|                                                                          |\n";
    Blue(); Center(L"[ ENTER ]  ENTRAR COM DISCORD"); Normal();
    std::wcout << L"|                                                                          |\n";
    Gray(); Center(L"Nesta versao de teste o login e local."); Normal();
    Center(L"A integracao final usara o Discord OAuth do site.");
    std::wcout << L"|                                                                          |\n";
    Center(L"ESC para sair");
    std::wcout << L"|                                                                          |\n";
    DrawLine();
}

void DrawProducts(const std::vector<Product>& products, size_t selected, const std::wstring& toast) {
    Clear();
    DrawHeader();
    Blue(); std::wcout << L"|  MEUS PRODUTOS                                                          |\n"; Normal();
    Gray(); std::wcout << L"|  Use as setas para navegar. ENTER copia a key e abre o produto.         |\n"; Normal();
    DrawLine();

    for (size_t i = 0; i < products.size(); ++i) {
        const auto& p = products[i];
        if (i == selected) {
            SetConsoleTextAttribute(gOut, BACKGROUND_BLUE | FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE | FOREGROUND_INTENSITY);
            std::wcout << L"| > " << p.game << L"  |  " << p.name;
            int used = 4 + (int)p.game.size() + 5 + (int)p.name.size();
            std::wcout << std::wstring(std::max(0, 75 - used), L' ') << L"|\n";
            Normal();
        } else {
            White();
            std::wcout << L"|   " << p.game << L"  |  " << p.name;
            int used = 4 + (int)p.game.size() + 5 + (int)p.name.size();
            std::wcout << std::wstring(std::max(0, 75 - used), L' ') << L"|\n";
            Normal();
        }

        Gray();
        std::wstring info = L"    Plano: " + p.plan + L"   Expira: " + p.expires;
        std::wcout << L"|" << info << std::wstring(std::max(0, 74 - (int)info.size()), L' ') << L"|\n";
        std::wstring key = L"    Key: " + Mask(p.key);
        std::wcout << L"|" << key << std::wstring(std::max(0, 74 - (int)key.size()), L' ') << L"|\n";
        Normal();
        if (p.maintenance) {
            Yellow();
            std::wstring st = L"    STATUS: MANUTENCAO";
            std::wcout << L"|" << st << std::wstring(std::max(0,74-(int)st.size()),L' ') << L"|\n";
        } else {
            Green();
            std::wstring st = L"    STATUS: ATIVO";
            std::wcout << L"|" << st << std::wstring(std::max(0,74-(int)st.size()),L' ') << L"|\n";
        }
        Normal();
        if (i + 1 < products.size()) {
            Gray(); std::wcout << L"|  ----------------------------------------------------------------------  |\n"; Normal();
        }
    }

    DrawLine();
    if (!toast.empty()) {
        Green();
        std::wstring msg = L"  " + toast;
        std::wcout << L"|" << msg << std::wstring(std::max(0,74-(int)msg.size()),L' ') << L"|\n";
        Normal();
    } else {
        Gray(); std::wcout << L"|  ENTER: copiar key + abrir   |   ESC: sair                               |\n"; Normal();
    }
    DrawLine();
}

void Launch(const Product& p, std::wstring& toast) {
    if (p.maintenance) { toast = L"Produto em manutencao."; return; }
    if (CopyClipboard(p.key)) toast = L"Key copiada. Quando o loader abrir, use CTRL+V.";
    else toast = L"Falha ao copiar a key.";

    if (!p.exePath.empty()) {
        auto result = ShellExecuteW(nullptr, L"runas", p.exePath.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
        if ((INT_PTR)result <= 32) toast += L" Loader nao encontrado.";
    }
}

int wmain() {
    SetConsoleTitleW(L"CRAZZY MULTILOADER CMD");
    SetConsoleOutputCP(CP_UTF8);
    HideCursor();

    std::vector<Product> products = {
        {L"VALORANT", L"Vanguard Emulator", L"30 dias", L"23/10/2026", L"CRAZ-TEST-VALO-2026", L"", false},
        {L"RUST", L"Rust External", L"7 dias", L"30/09/2026", L"CRAZ-TEST-RUST-91QZ", L"", false},
        {L"CS2", L"CS2 External", L"Mensal", L"18/10/2026", L"CRAZ-TEST-CS2-CKED", L"", true}
    };

    DrawLogin();
    while (true) {
        int k = _getwch();
        if (k == 27) return 0;
        if (k == 13) break;
    }

    size_t selected = 0;
    std::wstring toast;
    DrawProducts(products, selected, toast);

    while (true) {
        int k = _getwch();
        if (k == 27) break;
        if (k == 0 || k == 224) {
            int ext = _getwch();
            if (ext == 72 && !products.empty()) {
                selected = selected == 0 ? products.size() - 1 : selected - 1;
                toast.clear();
            } else if (ext == 80 && !products.empty()) {
                selected = (selected + 1) % products.size();
                toast.clear();
            }
            DrawProducts(products, selected, toast);
            continue;
        }
        if (k == 13 && !products.empty()) {
            Launch(products[selected], toast);
            DrawProducts(products, selected, toast);
        }
    }

    Clear();
    return 0;
}
