// Note: Please do not change the code in this file. Test code should go in the
// separate test files and called using selectCTest in the Jest code.
unsigned char main(void) {
    unsigned char ret;

    ret = (*(unsigned char (*)(void))(*(unsigned int *)(0x3fc)))();

    return ret;
}