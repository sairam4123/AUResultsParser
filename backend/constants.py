dept_codes = {
    "AIML": 148,
    "IT": 205,
}

subject_credit_mapping = {
    # Sem 7 subjects
    "GE3791": 2,
    "AI3021": 3,
    "CCS355": 3,
    "CCS374": 3,
    "GE3752": 3,
    "IT3711": 3,
    "OHS352": 3,
    "SB8067": 3,
    # Sem 5 subjects
    "CS3591": 4,
    "IT3501": 3,
    "CS3551": 3,
    "CS3691": 4,
    "CCS334": 3,
    "CCS335": 3,
    # honor courses disabled for now
    "CCS366": 0,
    "CCS360": 0,
    # ----
    "MX3084": 0,  # Non credit course
    "IT3511": 2,
    "NM1120": 2,  # 2 credits (currently disabled)
    # Sem 4 subjects
    "CS3451": 3,
    "CS3452": 3,
    "CS3461": 1.5,
    "CS3481": 1.5,
    "CS3491": 4,
    "CS3492": 3,
    "GE3451": 2,
    "IT3401": 4,
    # Disable the naan mudhalvan by setting credits to 0
    "NM1075": 2,  # 2 credits (currently disabled)
    "MA3354": 4,
    "CS3351": 4,
    "CS3352": 3,
    "CD3291": 3,
    "CS3391": 3,
    "CD3281": 2,
    "CS3381": 1.5,
    "CS3361": 2,
    "GE3361": 1,
    "NM1113": 0,  # 2 credits (currently disabled)
}

subject_sem_mapping = {
    # Sem 7 subjects
    "GE3791": 7,
    "AI3021": 7,
    "CCS355": 7,
    "CCS374": 7,
    "GE3752": 7,
    "IT3711": 7,
    "OHS352": 7,
    "SB8067": 7,
    # Sem 5 subjects
    "CS3591": 5,
    "IT3501": 5,
    "CS3551": 5,
    "CS3691": 5,
    "CCS334": 5,
    "CCS335": 5,
    "CCS366": 5,
    "CCS360": 5,
    "MX3084": 5,
    "IT3511": 5,
    "NM1120": 5,
    # Sem 4 subjects
    "CS3451": 4,
    "CS3452": 4,
    "CS3491": 4,
    "CS3492": 4,
    "GE3451": 4,
    "IT3401": 4,
    "CS3481": 4,
    "CS3461": 4,
    "NM1075": 4,
    # Sem 3 subjects
    "CS3351": 3,
    "CS3352": 3,
    "MA3354": 3,
    "CD3291": 3,
    "CS3391": 3,
    "CD3281": 3,
    "CS3381": 3,
    "CS3361": 3,
    "GE3361": 3,
    "NM1113": 3,  # 2 credits (currently disabled)
}

subject_name_mapping = {
    # Sem 7 subjects
    "GE3791": "Ethics and Human Values",
    "AI3021": "IT in Agriculture",
    "CCS355": "Unknown",
    "CCS374": "Unknown",
    "GE3752": "Unknown",
    "IT3711": "Unknown",
    "OHS352": "Unknown",
    "SB8067": "Unknown",
    # Sem 5 subjects
    "CS3591": "Computer Networks",
    "IT3501": "Full Stack Web Development",
    "CS3551": "Distributed Computing",
    "CS3691": "Embedded Systems and IoT",
    "CCS334": "Big Data Analytics",
    "CCS335": "Cloud Computing",
    "CCS366": "Software Testing and Automation",
    "CCS360": "Recomender Systems",
    "MX3084": "Disaster Risk Reduction and Management",
    "IT3511": "Full Stack Web Development Lab",
    "NM1120": "Naan Mudhalvan",
    # Sem 4 subjects
    "CS3451": "Introduction to Operating Systems",
    "CS3452": "Theory of Computation",
    "CS3491": "Artificial Intelligence and Machine Learning",
    "CS3492": "Database Management Systems",
    "GE3451": "Environmental Science and Sustainability",
    "IT3401": "Web Essentials",
    "CS3461": "Operating Systems Lab",
    "CS3481": "Database Management Systems Lab",
    "NM1075": "Naan Mudhalvan",
    # Sem 3 subjects
    "CS3351": "Digital Principles and Computer Organization",
    "CD3291": "Data Structures and Algorithm",
    "MA3354": "Discrete Mathematics",
    "CS3352": "Foundations of Data Science",
    "CS3391": "Object Oriented Programming",
    "CD3281": "Data Structures and Algorithm Lab",
    "CS3381": "Object Oriented Programming Lab",
    "CS3361": "Data Science Lab",
}


grade_mapping = {
    "O": 10,
    "A+": 9,
    "A": 8,
    "B+": 7,
    "B": 6,
    "C": 5,
    "U": 0,  # Reappear
    "UA": 0,  # Arrear Absent
    "NA": 0,  # Not Available
}


def calculate_sgpa(semester: int, grades: dict, all_subs: bool = False) -> float:
    if not (2 < semester < 9):
        raise ValueError("Semester must be between 3 and 8 inclusive.")

    # get subjects from semester_mapping
    subjects = (
        [
            sub for sub, res in grades.items() if res != "NA"
        ]  # ignore subjects with NA grade (Not Available)
        if not all_subs
        else [sub for sub, sem in subject_sem_mapping.items() if sem == semester]
    )
    print(subjects)
    credits = [subject_credit_mapping[sub] for sub in subjects]

    gps = []
    for subject in subjects:
        grade = grades.get(subject, "U")
        gp = grade_mapping[grade]
        gps.append(gp * credits[subjects.index(subject)])

    total_credits = sum(credits)
    total_gp = sum(gps)

    return total_gp / total_credits


def get_subjects_for_semester(semester: int) -> list[str]:
    return [sub for sub, sem in subject_sem_mapping.items() if sem == semester]


def get_subject_name(subject_code: str, short_name: bool = False) -> str:
    name = subject_name_mapping.get(subject_code, "Unknown Subject")
    # take the first letter of each word in the subject name to create a short name
    return (
        name
        if not short_name
        else "".join(word[0] for word in name.split() if word[0].isupper())
    )
