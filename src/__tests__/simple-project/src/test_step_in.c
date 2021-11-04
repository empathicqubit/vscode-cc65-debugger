#include <conio.h>

void stepIn() {
    cputs("If you see this after step\n");
    cputs("in, you failed\n");
}

unsigned char test_step_in_main(void) {
    stepIn();
    cputs("If you see this after step\n");
    cputs("out, you failed\n");
    return 0;
}